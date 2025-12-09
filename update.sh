#!/bin/bash

# StreamPanel Update Script with Auto Conflict Resolution

set -e

INSTALL_DIR="/opt/streampanel"

echo "========================================="
echo "     StreamPanel Auto Updater"
echo "========================================="

cd $INSTALL_DIR

# Save any local changes
echo "📦 Saving local changes..."
git stash --include-untracked 2>/dev/null || true

# Reset any conflicting files to match remote
echo "🔄 Resetting to remote version..."
git fetch origin main
git reset --hard origin/main

# Rebuild and restart containers
cd docker
echo "🔨 Rebuilding containers..."
docker compose build --no-cache

echo "🚀 Restarting services..."
docker compose up -d

echo ""
echo "========================================="
echo "     ✅ Update Complete!"
echo "========================================="
docker compose ps
