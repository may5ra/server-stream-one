#!/bin/bash

# StreamPanel Database Backup Script

set -e

INSTALL_DIR="/opt/streampanel"
BACKUP_DIR="/opt/streampanel/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/streampanel_backup_$TIMESTAMP.sql"

echo "========================================="
echo "     StreamPanel Database Backup"
echo "========================================="

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

cd $INSTALL_DIR/docker

# Get database credentials from .env
source .env 2>/dev/null || true

DB_USER=${DB_USER:-streampanel}
DB_NAME=${DB_NAME:-streampanel}

echo "📦 Creating database backup..."
docker exec streampanel-db pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
    # Compress backup
    gzip $BACKUP_FILE
    BACKUP_FILE="${BACKUP_FILE}.gz"
    
    echo "✅ Backup created: $BACKUP_FILE"
    
    # Keep only last 10 backups
    echo "🧹 Cleaning old backups..."
    ls -t $BACKUP_DIR/*.gz 2>/dev/null | tail -n +11 | xargs -r rm
    
    # Show backup size
    BACKUP_SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo "📊 Backup size: $BACKUP_SIZE"
    
    echo ""
    echo "========================================="
    echo "     ✅ Backup Complete!"
    echo "========================================="
else
    echo "❌ Backup failed!"
    exit 1
fi
