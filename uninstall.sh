#!/bin/bash

# StreamPanel Uninstall Script

set -e

INSTALL_DIR="/opt/streampanel"

echo "StreamPanel Uninstaller"
echo "======================="
echo ""
read -p "This will remove StreamPanel and ALL DATA. Are you sure? [y/N]: " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

cd $INSTALL_DIR/docker

# Stop and remove containers
echo "Stopping services..."
docker compose down -v

# Remove installation directory
echo "Removing files..."
rm -rf $INSTALL_DIR

echo "StreamPanel has been removed."
echo "Docker and Docker Compose are still installed."
