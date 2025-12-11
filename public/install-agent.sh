#!/bin/bash
# StreamPanel Load Balancer Agent
# Install: curl -sSL http://YOUR_SERVER/install-agent.sh | sudo bash -s -- --secret=YOUR_SECRET
# Or: AGENT_SECRET=your_secret bash install-agent.sh

set -e

# Parse arguments
for arg in "$@"; do
  case $arg in
    --secret=*)
      AGENT_SECRET="${arg#*=}"
      shift
      ;;
    --port=*)
      AGENT_PORT="${arg#*=}"
      shift
      ;;
  esac
done

AGENT_PORT="${AGENT_PORT:-3002}"
AGENT_SECRET="${AGENT_SECRET:-changeme}"
AGENT_DIR="/opt/streampanel"
LOG_FILE="/var/log/streampanel-agent.log"

echo "=========================================="
echo "StreamPanel Load Balancer Agent Installer"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo)"
  exit 1
fi

# Install dependencies
echo "[1/5] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq python3 nginx curl

# Create directory
echo "[2/5] Creating agent directory..."
mkdir -p "$AGENT_DIR"
touch "$LOG_FILE"

# Create the agent service
echo "[3/5] Creating agent script..."
cat > "$AGENT_DIR/agent.py" << 'AGENT_CODE'
#!/usr/bin/env python3
"""
StreamPanel Load Balancer Agent
Handles remote nginx configuration and health checks
"""
import http.server
import json
import subprocess
import os
import sys
from datetime import datetime

PORT = int(os.environ.get('AGENT_PORT', 3002))
SECRET = os.environ.get('AGENT_SECRET', 'changeme')
VERSION = '1.1.0'

class AgentHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open('/var/log/streampanel-agent.log', 'a') as f:
            f.write(f"[{timestamp}] {format % args}\n")
        print(f"[{timestamp}] {format % args}")

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type, x-agent-secret')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def check_auth(self):
        """Check authentication via header"""
        auth_header = self.headers.get('X-Agent-Secret', '')
        auth_bearer = self.headers.get('Authorization', '').replace('Bearer ', '')
        return auth_header == SECRET or auth_bearer == SECRET

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type, x-agent-secret')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests - health check"""
        if self.path == '/health' or self.path == '/':
            self.send_json(200, {
                'status': 'ok',
                'version': VERSION,
                'timestamp': datetime.now().isoformat()
            })
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        """Handle POST requests - configuration deployment"""
        # Check authorization
        if not self.check_auth():
            self.log_message('Unauthorized request from %s', self.client_address[0])
            self.send_json(401, {'error': 'Unauthorized'})
            return

        # Read body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode()
        
        try:
            data = json.loads(body)
        except:
            self.send_json(400, {'error': 'Invalid JSON'})
            return

        path = self.path
        action = data.get('action', '')
        
        self.log_message('Action: %s, Path: %s', action, path)

        # Handle /deploy endpoint
        if path == '/deploy':
            if action == 'write-config':
                return self.handle_write_config(data)
            elif action == 'execute':
                return self.handle_execute(data)
            else:
                self.send_json(400, {'error': f'Unknown action: {action}'})
                return
        
        # Legacy endpoints
        if action == 'exec':
            return self.handle_legacy_exec(data)
        elif action == 'write-config':
            return self.handle_write_config(data)
        elif action == 'health':
            self.send_json(200, {'status': 'ok', 'version': VERSION})
        else:
            self.send_json(400, {'error': f'Unknown action: {action}'})

    def handle_write_config(self, data):
        """Write nginx configuration file"""
        config = data.get('content', data.get('config', ''))
        config_path = data.get('path', '/etc/nginx/sites-available/streampanel-lb.conf')
        
        if not config:
            self.send_json(400, {'error': 'No config content provided'})
            return
        
        try:
            # Write config file
            with open(config_path, 'w') as f:
                f.write(config)
            
            self.log_message('Config written to %s', config_path)
            
            self.send_json(200, {
                'success': True,
                'message': f'Config written to {config_path}',
                'path': config_path
            })
        except Exception as e:
            self.log_message('Error writing config: %s', str(e))
            self.send_json(500, {'error': str(e)})

    def handle_execute(self, data):
        """Execute shell command"""
        command = data.get('command', '')
        
        if not command:
            self.send_json(400, {'error': 'No command provided'})
            return
        
        try:
            self.log_message('Executing: %s', command)
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            success = result.returncode == 0
            self.log_message('Command result: %s (code %d)', 'success' if success else 'failed', result.returncode)
            
            self.send_json(200, {
                'success': success,
                'output': result.stdout + result.stderr,
                'code': result.returncode
            })
        except subprocess.TimeoutExpired:
            self.send_json(500, {'error': 'Command timeout'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

    def handle_legacy_exec(self, data):
        """Handle legacy exec commands (predefined only)"""
        cmd = data.get('command')
        allowed_commands = {
            'nginx-test': 'nginx -t',
            'nginx-reload': 'systemctl reload nginx',
            'nginx-restart': 'systemctl restart nginx',
            'nginx-status': 'systemctl status nginx --no-pager',
        }
        
        if cmd not in allowed_commands:
            self.send_json(400, {'error': f'Command not allowed: {cmd}'})
            return
        
        try:
            result = subprocess.run(
                allowed_commands[cmd],
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            self.send_json(200, {
                'success': result.returncode == 0,
                'output': result.stdout + result.stderr,
                'code': result.returncode
            })
        except subprocess.TimeoutExpired:
            self.send_json(500, {'error': 'Command timeout'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})

if __name__ == '__main__':
    print(f"StreamPanel LB Agent v{VERSION} starting on port {PORT}")
    print(f"Health check: http://0.0.0.0:{PORT}/health")
    server = http.server.HTTPServer(('0.0.0.0', PORT), AgentHandler)
    server.serve_forever()
AGENT_CODE

chmod +x "$AGENT_DIR/agent.py"

# Create systemd service
echo "[4/5] Creating systemd service..."
cat > /etc/systemd/system/streampanel-agent.service << EOF
[Unit]
Description=StreamPanel Load Balancer Agent
After=network.target nginx.service

[Service]
Type=simple
Environment="AGENT_PORT=$AGENT_PORT"
Environment="AGENT_SECRET=$AGENT_SECRET"
ExecStart=/usr/bin/python3 $AGENT_DIR/agent.py
Restart=always
RestartSec=5
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE

[Install]
WantedBy=multi-user.target
EOF

# Setup nginx directories
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Check if sites-enabled is included in nginx.conf
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
    echo "[!] Adding sites-enabled to nginx.conf..."
    sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
fi

# Enable and start service
echo "[5/5] Starting agent service..."
systemctl daemon-reload
systemctl enable streampanel-agent
systemctl restart streampanel-agent

# Wait for service to start
sleep 2

# Test agent
echo ""
echo "Testing agent..."
if curl -s "http://localhost:$AGENT_PORT/health" | grep -q "ok"; then
    echo "✓ Agent is running!"
else
    echo "✗ Agent failed to start. Check logs: journalctl -u streampanel-agent"
fi

echo ""
echo "=========================================="
echo "StreamPanel LB Agent installed!"
echo "=========================================="
echo ""
echo "Agent URL: http://$(hostname -I | awk '{print $1}'):$AGENT_PORT"
echo "Health:    http://$(hostname -I | awk '{print $1}'):$AGENT_PORT/health"
echo "Port:      $AGENT_PORT"
echo "Secret:    $AGENT_SECRET"
echo ""
echo "Commands:"
echo "  Status:  systemctl status streampanel-agent"
echo "  Logs:    tail -f $LOG_FILE"
echo "  Restart: systemctl restart streampanel-agent"
echo ""
echo "IMPORTANT: Make sure port $AGENT_PORT is open in firewall!"
echo "  ufw allow $AGENT_PORT/tcp"
echo "=========================================="
