#!/bin/bash
# StreamPanel Load Balancer Agent v2.1
# Automatska instalacija agenta i nginx-a

set -e

echo "=========================================="
echo "StreamPanel LB Agent Installer v2.1"
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

# Stop existing services
echo "[1/8] Stopping existing services..."
systemctl stop streampanel-agent 2>/dev/null || true
systemctl disable streampanel-agent 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

# Kill any process on agent port
fuser -k ${AGENT_PORT}/tcp 2>/dev/null || true

# Fix any broken packages
echo "[2/8] Fixing broken packages..."
dpkg --configure -a 2>/dev/null || true
apt-get --fix-broken install -y 2>/dev/null || true

# Install dependencies
echo "[3/8] Installing dependencies..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 curl ufw

# Install nginx separately (more robust)
echo "[4/8] Installing nginx..."
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx || {
  echo "Retrying nginx installation..."
  apt-get remove -y nginx nginx-common nginx-core 2>/dev/null || true
  apt-get autoremove -y
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
}

# Create directories
AGENT_DIR="/opt/streampanel"
LOG_FILE="/var/log/streampanel-agent.log"

echo "[5/8] Creating directories..."
mkdir -p "$AGENT_DIR"
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
rm -f "$AGENT_DIR/agent.py"
touch "$LOG_FILE"

# Create the agent script
echo "[6/8] Creating agent script..."
cat > "$AGENT_DIR/agent.py" << 'PYTHONCODE'
#!/usr/bin/env python3
import http.server
import json
import subprocess
import os
import time
from datetime import datetime

PORT = int(os.environ.get('AGENT_PORT', 3002))
SECRET = os.environ.get('AGENT_SECRET', 'changeme')
VERSION = '2.2.0'

# Cache for metrics
metrics_cache = {
    'cpu': 0,
    'ram': 0,
    'ram_total': 0,
    'ram_used': 0,
    'input_mbps': 0,
    'output_mbps': 0,
    'connections': 0,
    'streams': 0,
    'uptime': '',
    'last_update': 0
}

def get_cpu_usage():
    try:
        result = subprocess.run(
            "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}'",
            shell=True, capture_output=True, text=True, timeout=5
        )
        return round(float(result.stdout.strip()), 1)
    except:
        return 0

def get_ram_usage():
    try:
        result = subprocess.run(
            "free -m | awk 'NR==2{printf \"%s %s %.1f\", $3, $2, $3*100/$2}'",
            shell=True, capture_output=True, text=True, timeout=5
        )
        parts = result.stdout.strip().split()
        return {
            'used_mb': int(parts[0]),
            'total_mb': int(parts[1]),
            'percent': float(parts[2])
        }
    except:
        return {'used_mb': 0, 'total_mb': 0, 'percent': 0}

def get_network_usage():
    try:
        # Get bytes from all interfaces except lo
        result = subprocess.run(
            "cat /proc/net/dev | tail -n +3 | grep -v lo | awk '{rx+=$2; tx+=$10} END {print rx, tx}'",
            shell=True, capture_output=True, text=True, timeout=5
        )
        parts = result.stdout.strip().split()
        return {'rx_bytes': int(parts[0]), 'tx_bytes': int(parts[1])}
    except:
        return {'rx_bytes': 0, 'tx_bytes': 0}

# Store previous network reading for calculating rate
prev_network = {'rx': 0, 'tx': 0, 'time': 0}

def get_bandwidth():
    global prev_network
    current = get_network_usage()
    current_time = time.time()
    
    if prev_network['time'] == 0:
        prev_network = {'rx': current['rx_bytes'], 'tx': current['tx_bytes'], 'time': current_time}
        return {'input_mbps': 0, 'output_mbps': 0}
    
    time_diff = current_time - prev_network['time']
    if time_diff < 1:
        time_diff = 1
    
    rx_rate = (current['rx_bytes'] - prev_network['rx']) / time_diff / 1024 / 1024 * 8  # Mbps
    tx_rate = (current['tx_bytes'] - prev_network['tx']) / time_diff / 1024 / 1024 * 8  # Mbps
    
    prev_network = {'rx': current['rx_bytes'], 'tx': current['tx_bytes'], 'time': current_time}
    
    return {'input_mbps': round(rx_rate, 2), 'output_mbps': round(tx_rate, 2)}

def get_nginx_connections():
    try:
        result = subprocess.run(
            "netstat -an | grep ':80\\|:8080' | grep ESTABLISHED | wc -l",
            shell=True, capture_output=True, text=True, timeout=5
        )
        return int(result.stdout.strip())
    except:
        return 0

def get_active_streams():
    try:
        result = subprocess.run(
            "ls /etc/nginx/sites-enabled/*.conf 2>/dev/null | wc -l",
            shell=True, capture_output=True, text=True, timeout=5
        )
        return max(0, int(result.stdout.strip()) - 1)  # Subtract default config
    except:
        return 0

def get_uptime():
    try:
        result = subprocess.run(
            "uptime -p",
            shell=True, capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip().replace('up ', '')
    except:
        return 'unknown'

def update_metrics():
    global metrics_cache
    now = time.time()
    if now - metrics_cache['last_update'] < 2:  # Cache for 2 seconds
        return metrics_cache
    
    ram = get_ram_usage()
    bw = get_bandwidth()
    
    metrics_cache = {
        'cpu': get_cpu_usage(),
        'ram': ram['percent'],
        'ram_total': ram['total_mb'],
        'ram_used': ram['used_mb'],
        'input_mbps': bw['input_mbps'],
        'output_mbps': bw['output_mbps'],
        'connections': get_nginx_connections(),
        'streams': get_active_streams(),
        'uptime': get_uptime(),
        'last_update': now
    }
    return metrics_cache

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        msg = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}"
        print(msg)
        try:
            with open('/var/log/streampanel-agent.log', 'a') as f:
                f.write(msg + '\n')
        except:
            pass

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
        elif self.path == '/metrics':
            # No auth required for metrics - quick polling
            metrics = update_metrics()
            self.send_json(200, {
                'status': 'ok',
                'version': VERSION,
                'cpu_usage': metrics['cpu'],
                'ram_usage': metrics['ram'],
                'ram_total_mb': metrics['ram_total'],
                'ram_used_mb': metrics['ram_used'],
                'input_mbps': metrics['input_mbps'],
                'output_mbps': metrics['output_mbps'],
                'connections': metrics['connections'],
                'streams': metrics['streams'],
                'uptime': metrics['uptime']
            })
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
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
                self.send_json(200, {
                    'success': result.returncode == 0,
                    'output': result.stdout + result.stderr,
                    'code': result.returncode
                })
            except Exception as e:
                self.send_json(500, {'error': str(e)})
        
        elif action == 'health':
            self.send_json(200, {'status': 'ok', 'version': VERSION})
        
        elif action == 'metrics':
            metrics = update_metrics()
            self.send_json(200, metrics)
        
        else:
            self.send_json(400, {'error': f'Unknown action: {action}'})

if __name__ == '__main__':
    print(f"StreamPanel Agent v{VERSION} on port {PORT}")
    print(f"Metrics endpoint: http://0.0.0.0:{PORT}/metrics")
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    server.serve_forever()
PYTHONCODE

chmod +x "$AGENT_DIR/agent.py"

# Create systemd service
echo "[7/8] Creating systemd service..."
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

# Configure nginx
echo "[7.5/8] Configuring nginx..."

# Make sure nginx includes sites-enabled
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf 2>/dev/null; then
  sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf 2>/dev/null || true
fi

# Remove default site if it conflicts
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t 2>/dev/null || {
  echo "Creating minimal nginx config..."
  cat > /etc/nginx/nginx.conf << 'NGINXCONF'
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    include /etc/nginx/sites-enabled/*;
}
NGINXCONF
}

# Start services
echo "[8/8] Starting services..."
systemctl daemon-reload
systemctl enable nginx
systemctl start nginx || true
systemctl enable streampanel-agent
systemctl start streampanel-agent

# Open firewall
echo "Opening firewall ports..."
ufw allow $AGENT_PORT/tcp 2>/dev/null || true
ufw allow 80/tcp 2>/dev/null || true
ufw allow 8080/tcp 2>/dev/null || true

# Wait and test
sleep 3

echo ""
echo "=========================================="
echo "Testing agent on port $AGENT_PORT..."
echo "=========================================="

if curl -s "http://localhost:$AGENT_PORT/health" 2>/dev/null | grep -q "ok"; then
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo ""
    echo "✅ SUCCESS! Agent is running!"
    echo ""
    echo "Agent URL: http://${PUBLIC_IP}:$AGENT_PORT"
    echo "Health:    http://${PUBLIC_IP}:$AGENT_PORT/health"
    echo ""
    echo "Nginx status: $(systemctl is-active nginx)"
    echo ""
    echo "U panelu koristi ovu IP adresu: $PUBLIC_IP"
else
    echo ""
    echo "⚠️ WARNING: Agent may not be running properly"
    echo "Check logs: journalctl -u streampanel-agent -n 50"
    echo ""
    echo "Try manual start:"
    echo "  python3 /opt/streampanel/agent.py"
fi

echo "=========================================="
