#!/usr/bin/env bash
set -euo pipefail
: "${DB_USERNAME:?}" "${DB_PASSWORD:?}"
DB_NAME="${DB_NAME:-tabitrace}"
OUT_DIR="${BACKUP_DIR:-/opt/tabitrace/backups/mysql}"
mkdir -p "$OUT_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
MYSQL_PWD="$DB_PASSWORD" mysqldump --single-transaction --routines --triggers -u "$DB_USERNAME" "$DB_NAME" | gzip > "$OUT_DIR/tabitrace-$STAMP.sql.gz"
find "$OUT_DIR" -type f -name 'tabitrace-*.sql.gz' -mtime +30 -delete
echo "$OUT_DIR/tabitrace-$STAMP.sql.gz"
