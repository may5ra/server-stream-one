#!/bin/bash

# StreamPanel Update Script with Auto Backup & Conflict Resolution

set -e

INSTALL_DIR="/opt/streampanel"
BACKUP_DIR="/opt/streampanel/backups"

echo "========================================="
echo "     StreamPanel Auto Updater"
echo "========================================="

cd $INSTALL_DIR

# Step 1: Create backup before update
echo ""
echo "📦 Step 1: Creating database backup..."
./backup.sh

# Step 2: Save local changes
echo ""
echo "💾 Step 2: Saving local changes..."
git stash --include-untracked 2>/dev/null || true

# Step 3: Reset to remote version
echo ""
echo "🔄 Step 3: Fetching latest version..."
git fetch origin main
git reset --hard origin/main

# Step 4: Rebuild containers
cd docker
echo ""
echo "🔨 Step 4: Rebuilding containers..."
docker compose build --no-cache

# Step 5: Restart services
echo ""
echo "🚀 Step 5: Restarting services..."
docker compose up -d

echo ""
echo "========================================="
echo "     ✅ Update Complete!"
echo "========================================="
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
docker compose ps
