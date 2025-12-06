#!/bin/bash

# StreamPanel - Ubuntu Server Installation Script
# Supports Ubuntu 20.04, 22.04, 24.04

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/streampanel"
REPO_URL="https://github.com/may5ra/server-stream-one.git"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           StreamPanel - IPTV Panel Installer              ║"
echo "║                   Ubuntu Server                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./install.sh)${NC}"
    exit 1
fi

# Get server info
echo -e "${YELLOW}Enter your configuration:${NC}"
read -p "Server domain or IP [localhost]: " SERVER_DOMAIN
SERVER_DOMAIN=${SERVER_DOMAIN:-localhost}

read -p "Database password [auto-generate]: " DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
    echo -e "${GREEN}Generated DB password: $DB_PASSWORD${NC}"
fi

read -p "JWT Secret [auto-generate]: " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
fi

read -p "Enable RTMP streaming server? [y/N]: " ENABLE_RTMP
ENABLE_RTMP=${ENABLE_RTMP:-n}

echo ""
echo -e "${BLUE}Step 1/5: Updating system...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

echo -e "${BLUE}Step 2/5: Installing dependencies...${NC}"
apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Install Docker
echo -e "${BLUE}Step 3/5: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    usermod -aG docker $SUDO_USER 2>/dev/null || true
    
    # Enable Docker service
    systemctl enable docker
    systemctl start docker
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}Docker Compose already installed${NC}"
fi

echo -e "${BLUE}Step 4/5: Setting up StreamPanel...${NC}"

# Create installation directory
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Clone repository (or copy files if already exists)
if [ -d ".git" ]; then
    echo "Updating existing installation..."
    git pull
else
    echo "Cloning repository..."
    if [ -n "$REPO_URL" ] && [ "$REPO_URL" != "https://github.com/YOUR_USERNAME/YOUR_REPO.git" ]; then
        git clone $REPO_URL .
    else
        echo -e "${YELLOW}Repository URL not configured. Please update REPO_URL in script or clone manually.${NC}"
        echo -e "${YELLOW}For now, creating directory structure...${NC}"
        mkdir -p docker/backend docker/nginx
    fi
fi

# Create environment file
cd docker
cat > .env << EOF
# StreamPanel Configuration
# Generated on $(date)

# Database
DB_USER=streampanel
DB_PASSWORD=$DB_PASSWORD
DB_NAME=streampanel

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Server
SERVER_DOMAIN=$SERVER_DOMAIN
EOF

echo -e "${GREEN}Environment file created${NC}"

# Configure firewall
echo -e "${BLUE}Step 5/5: Configuring firewall...${NC}"
ufw --force enable
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # API (optional, remove in production)

if [[ "$ENABLE_RTMP" =~ ^[Yy]$ ]]; then
    ufw allow 1935/tcp  # RTMP
    ufw allow 8080/tcp  # HLS
fi

# Start services
echo -e "${BLUE}Starting StreamPanel...${NC}"

if [[ "$ENABLE_RTMP" =~ ^[Yy]$ ]]; then
    docker compose --profile streaming up -d --build
else
    docker compose up -d --build
fi

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check if services are running
if docker ps | grep -q "streampanel"; then
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           StreamPanel Installation Complete!              ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo -e "${GREEN}Access your panel:${NC}"
    echo -e "  URL: ${BLUE}http://$SERVER_DOMAIN${NC}"
    echo -e "  Login: ${YELLOW}admin@streampanel.local${NC}"
    echo -e "  Password: ${YELLOW}admin123${NC}"
    echo ""
    echo -e "${GREEN}Xtream Codes API:${NC}"
    echo -e "  ${BLUE}http://$SERVER_DOMAIN/player_api.php?username=USER&password=PASS${NC}"
    echo ""
    echo -e "${GREEN}M3U Playlist:${NC}"
    echo -e "  ${BLUE}http://$SERVER_DOMAIN/get.php?username=USER&password=PASS&type=m3u_plus${NC}"
    echo ""
    if [[ "$ENABLE_RTMP" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}RTMP Streaming:${NC}"
        echo -e "  Push: ${BLUE}rtmp://$SERVER_DOMAIN:1935/live/STREAMKEY${NC}"
        echo -e "  Play: ${BLUE}http://$SERVER_DOMAIN:8080/hls/STREAMKEY.m3u8${NC}"
        echo ""
    fi
    echo -e "${YELLOW}Important: Change admin password after first login!${NC}"
    echo ""
    echo -e "Installation directory: $INSTALL_DIR"
    echo -e "Logs: docker compose logs -f"
    echo ""
    
    # Save credentials
    cat > $INSTALL_DIR/credentials.txt << EOF
StreamPanel Installation Credentials
=====================================
Generated: $(date)

Panel URL: http://$SERVER_DOMAIN
Admin Email: admin@streampanel.local
Admin Password: admin123 (CHANGE THIS!)

Database Password: $DB_PASSWORD

Xtream API: http://$SERVER_DOMAIN/player_api.php
M3U Playlist: http://$SERVER_DOMAIN/get.php
EOF
    chmod 600 $INSTALL_DIR/credentials.txt
    echo -e "${YELLOW}Credentials saved to: $INSTALL_DIR/credentials.txt${NC}"
else
    echo -e "${RED}Installation may have issues. Check logs with: docker compose logs${NC}"
fi
