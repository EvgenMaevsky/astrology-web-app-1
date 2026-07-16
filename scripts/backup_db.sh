#!/bin/sh
# Daily Postgres backup. Cron on the VPS:
#   0 3 * * * cd /opt/zorya/infra && sh ../scripts/backup_db.sh >> /var/log/zorya-backup.log 2>&1
set -eu
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U zorya zorya | gzip > "$DIR/zorya-$STAMP.sql.gz"
# keep last 14
ls -t "$DIR"/zorya-*.sql.gz | tail -n +15 | xargs -r rm
# optional offsite copy: uncomment after `rclone config` on the VPS
# rclone copy "$DIR/zorya-$STAMP.sql.gz" b2:zorya-backups/
echo "backup done: zorya-$STAMP.sql.gz"
