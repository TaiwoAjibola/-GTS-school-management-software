#!/bin/bash
# ============================================================
# SAMS - Backup Supabase Database
# Usage: ./scripts/backup-supabase.sh
# ============================================================

set -e

echo "=== SAMS Supabase Backup ==="

if [ -z "$SUPABASE_DATABASE_URL" ]; then
  echo "Error: SUPABASE_DATABASE_URL environment variable is required"
  echo "Get from Supabase dashboard -> Settings -> Database -> Connection string (URI)"
  echo "Use port 5432 (direct connection), not 6543"
  exit 1
fi

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sams_supabase_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Backing up Supabase database..."
echo "Output: ${BACKUP_FILE}"

pg_dump \
  "$SUPABASE_DATABASE_URL" \
  --format=custom \
  --verbose \
  -f "$BACKUP_FILE"

echo ""
echo "Backup completed!"
echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
echo "To restore:"
echo "pg_restore --dbname=\"your_connection_url\" ${BACKUP_FILE}"
