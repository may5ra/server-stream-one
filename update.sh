#!/bin/bash

# StreamPanel Update Script

set -e

INSTALL_DIR="/opt/streampanel"

echo "StreamPanel Updater"
echo "==================="

cd $INSTALL_DIR

# Pull latest changes
echo "Pulling latest changes..."
git pull

# Rebuild and restart
cd docker
echo "Rebuilding containers..."
docker compose build --no-cache

echo "Restarting services..."
docker compose up -d

echo "Update complete!"
docker compose ps
