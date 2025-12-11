#!/bin/bash
# StreamPanel Load Balancer Agent v2.0
# Install: curl -sSL http://YOUR_SERVER/install-agent.sh | sudo bash -s -- --secret=YOUR_SECRET

set -e

echo "=========================================="
echo "StreamPanel LB Agent Installer v2.0"
echo "=========================================="

# Default values
AGENT_PORT="3002"
AGENT_SECRET="changeme"

# Parse arguments
for arg in "$@"; do
  case $arg in
    --secret=*)
      AGENT_SECRET="${arg#*=}"
      ;;
    --port=*)
      AGENT_PORT="${arg#*=}"
      ;;
  esac
done

echo "Port: $AGENT_PORT"
echo "Secret: $AGENT_SECRET"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo)"
  exit 1
fi

# Stop existing agent if running
echo "[1/6] Stopping existing agent..."
systemctl stop streampanel-agent 2>/dev/null || true
systemctl disable streampanel-agent 2>/dev/null || true

# Install dependencies
echo "[2/6] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq python3 nginx curl

# Create directory
AGENT_DIR="/opt/streampanel"
LOG_FILE="/var/log/streampanel-agent.log"

echo "[3/6] Creating agent directory..."
mkdir -p "$AGENT_DIR"
rm -f "$AGENT_DIR/agent.py"
touch "$LOG_FILE"

# Create the agent script
echo "[4/6] Creating agent script..."
cat > "$AGENT_DIR/agent.py" << 'PYTHONCODE'
#!/usr/bin/env python3
import http.server
import json
import subprocess
import os
from datetime import datetime

PORT = int(os.environ.get('AGENT_PORT', 3002))
SECRET = os.environ.get('AGENT_SECRET', 'changeme')
VERSION = '2.0.0'

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        msg = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}"
        print(msg)
        with open('/var/log/streampanel-agent.log', 'a') as f:
            f.write(msg + '\n')

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type, x-agent-secret')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def check_auth(self):
        h1 = self.headers.get('X-Agent-Secret', '')
        h2 = self.headers.get('Authorization', '').replace('Bearer ', '')
        return h1 == SECRET or h2 == SECRET

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type, x-agent-secret')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health' or self.path == '/':
            self.send_json(200, {'status': 'ok', 'version': VERSION, 'port': PORT})
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        if not self.check_auth():
            self.send_json(401, {'error': 'Unauthorized'})
            return

        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode()
        
        try:
            data = json.loads(body)
        except:
            self.send_json(400, {'error': 'Invalid JSON'})
            return

        action = data.get('action', '')
        
        if action == 'write-config':
            config = data.get('content', data.get('config', ''))
            path = data.get('path', '/etc/nginx/sites-available/streampanel-lb.conf')
            try:
                with open(path, 'w') as f:
                    f.write(config)
                self.send_json(200, {'success': True, 'path': path})
            except Exception as e:
                self.send_json(500, {'error': str(e)})
        
        elif action == 'execute':
            cmd = data.get('command', '')
            try:
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
                self.send_json(200, {
                    'success': result.returncode == 0,
                    'output': result.stdout + result.stderr,
                    'code': result.returncode
                })
            except Exception as e:
                self.send_json(500, {'error': str(e)})
        
        elif action == 'health':
            self.send_json(200, {'status': 'ok', 'version': VERSION})
        
        else:
            self.send_json(400, {'error': f'Unknown action: {action}'})

if __name__ == '__main__':
    print(f"StreamPanel Agent v{VERSION} on port {PORT}")
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    server.serve_forever()
PYTHONCODE

chmod +x "$AGENT_DIR/agent.py"

# Create systemd service
echo "[5/6] Creating systemd service..."
rm -f /etc/systemd/system/streampanel-agent.service

cat > /etc/systemd/system/streampanel-agent.service << SERVICEEOF
[Unit]
Description=StreamPanel Load Balancer Agent
After=network.target

[Service]
Type=simple
Environment="AGENT_PORT=$AGENT_PORT"
Environment="AGENT_SECRET=$AGENT_SECRET"
ExecStart=/usr/bin/python3 /opt/streampanel/agent.py
Restart=always
RestartSec=5
StandardOutput=append:/var/log/streampanel-agent.log
StandardError=append:/var/log/streampanel-agent.log

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Setup nginx
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
grep -q "sites-enabled" /etc/nginx/nginx.conf || sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf

# Start service
echo "[6/6] Starting agent..."
systemctl daemon-reload
systemctl enable streampanel-agent
systemctl start streampanel-agent

# Wait and test
sleep 3

echo ""
echo "=========================================="
echo "Testing agent on port $AGENT_PORT..."
echo "=========================================="

if curl -s "http://localhost:$AGENT_PORT/health" 2>/dev/null | grep -q "ok"; then
    echo "SUCCESS! Agent is running!"
    echo ""
    echo "Agent URL: http://$(hostname -I | awk '{print $1}'):$AGENT_PORT"
    echo "Health:    http://$(hostname -I | awk '{print $1}'):$AGENT_PORT/health"
    echo ""
    echo "IMPORTANT: Open firewall port!"
    echo "  ufw allow $AGENT_PORT/tcp"
else
    echo "WARNING: Agent may not be running properly"
    echo "Check logs: journalctl -u streampanel-agent -n 50"
    echo ""
    echo "Try manual start:"
    echo "  python3 /opt/streampanel/agent.py"
fi

echo "=========================================="
