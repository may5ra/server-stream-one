#!/bin/bash
# StreamPanel Server Agent
# Install: curl -sSL https://your-server/agent.sh | sudo bash
# Or copy this script to /opt/streampanel/agent.sh

set -e

AGENT_PORT="${AGENT_PORT:-9876}"
AGENT_SECRET="${AGENT_SECRET:-changeme}"
AGENT_DIR="/opt/streampanel"
LOG_FILE="/var/log/streampanel-agent.log"

# Create directory
mkdir -p "$AGENT_DIR"

# Create the agent service
cat > "$AGENT_DIR/agent.py" << 'AGENT_CODE'
#!/usr/bin/env python3
import http.server
import json
import subprocess
import os
import sys
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get('AGENT_PORT', 9876))
SECRET = os.environ.get('AGENT_SECRET', 'changeme')

class AgentHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        with open('/var/log/streampanel-agent.log', 'a') as f:
            f.write(f"{self.log_date_time_string()} - {format % args}\n")

    def send_json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type')
        self.end_headers()

    def do_POST(self):
        # Check authorization
        auth = self.headers.get('Authorization', '')
        if auth != f'Bearer {SECRET}':
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

        action = data.get('action')
        
        if action == 'exec':
            # Execute a predefined command
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
        
        elif action == 'write-config':
            # Write nginx proxy config
            config = data.get('config', '')
            path = '/etc/nginx/sites-available/stream-proxy'
            
            try:
                with open(path, 'w') as f:
                    f.write(config)
                
                # Create symlink if not exists
                link = '/etc/nginx/sites-enabled/stream-proxy'
                if not os.path.exists(link):
                    os.symlink(path, link)
                
                # Test nginx config
                test = subprocess.run('nginx -t', shell=True, capture_output=True, text=True)
                if test.returncode != 0:
                    self.send_json(400, {
                        'error': 'Nginx config test failed',
                        'output': test.stderr
                    })
                    return
                
                # Reload nginx
                reload = subprocess.run('systemctl reload nginx', shell=True, capture_output=True, text=True)
                
                self.send_json(200, {
                    'success': True,
                    'message': 'Config applied and nginx reloaded',
                    'test_output': test.stderr,
                    'reload_output': reload.stdout + reload.stderr
                })
            except Exception as e:
                self.send_json(500, {'error': str(e)})
        
        elif action == 'health':
            self.send_json(200, {'status': 'ok', 'version': '1.0'})
        
        else:
            self.send_json(400, {'error': f'Unknown action: {action}'})

print(f"StreamPanel Agent starting on port {PORT}")
server = http.server.HTTPServer(('0.0.0.0', PORT), AgentHandler)
server.serve_forever()
AGENT_CODE

chmod +x "$AGENT_DIR/agent.py"

# Create systemd service
cat > /etc/systemd/system/streampanel-agent.service << EOF
[Unit]
Description=StreamPanel Server Agent
After=network.target

[Service]
Type=simple
Environment="AGENT_PORT=$AGENT_PORT"
Environment="AGENT_SECRET=$AGENT_SECRET"
ExecStart=/usr/bin/python3 $AGENT_DIR/agent.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable streampanel-agent
systemctl start streampanel-agent

echo "========================================"
echo "StreamPanel Agent installed!"
echo "Port: $AGENT_PORT"
echo "Secret: $AGENT_SECRET"
echo ""
echo "IMPORTANT: Change the secret!"
echo "Edit: /etc/systemd/system/streampanel-agent.service"
echo "Then: systemctl daemon-reload && systemctl restart streampanel-agent"
echo "========================================"
