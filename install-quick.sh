#!/bin/bash

# StreamPanel Quick Install (one-liner)
# Usage: curl -fsSL https://raw.githubusercontent.com/may5ra/server-stream-one/main/install-quick.sh | sudo bash

set -e

echo "StreamPanel - Quick Installer"
echo "=============================="

# Install git if not present
apt-get update -qq && apt-get install -y git curl

# Download and run main installer
INSTALL_DIR="/opt/streampanel"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Clone repo
git clone https://github.com/may5ra/server-stream-one.git . 2>/dev/null || git pull

# Run installer
chmod +x install.sh
./install.sh
