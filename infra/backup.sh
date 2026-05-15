#!/bin/bash
# PaperChampion data backup script.
#
# Example crontab entry:
#   0 3 * * * /opt/paperchampion/backup.sh >> /opt/paperchampion/backups/backup.log 2>&1

set -euo pipefail

DEPLOY_DIR="${PAPERCHAMPION_DEPLOY_DIR:-/opt/paperchampion}"
BACKUP_DIR="${PAPERCHAMPION_BACKUP_DIR:-/opt/paperchampion/backups}"
DATA_DIR="$DEPLOY_DIR/data"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

# Back up SQLite without locking the live database.
DB_FILE="$DATA_DIR/paperchampion.db"
if [ -f "$DB_FILE" ]; then
    sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/paperchampion_$DATE.db'"
    echo "[$(date)] DB backup: paperchampion_$DATE.db"
else
    echo "[$(date)] WARNING: DB file not found at $DB_FILE"
fi

# Package papers and briefs when they exist.
if [ -d "$DATA_DIR/papers" ] || [ -d "$DATA_DIR/briefs" ]; then
    tar -czf "$BACKUP_DIR/papers_$DATE.tar.gz" \
        -C "$DATA_DIR" papers/ briefs/ 2>/dev/null || true
    echo "[$(date)] Files backup: papers_$DATE.tar.gz"
fi

# Remove expired backups.
find "$BACKUP_DIR" -name "paperchampion_*.db" -mtime +$KEEP_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "papers_*.tar.gz" -mtime +$KEEP_DAYS -delete 2>/dev/null || true

echo "[$(date)] Backup completed. Retained last $KEEP_DAYS days."
