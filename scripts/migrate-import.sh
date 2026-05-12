#!/bin/bash
# ============================================================
# SAMS - Import data to Supabase
# Usage: ./scripts/migrate-import.sh
# ============================================================

set -e

echo "=== SAMS Database Import (Supabase) ==="

# Check for required environment variables
if [ -z "$SUPABASE_DB_HOST" ]; then
  echo "Error: SUPABASE_DB_HOST environment variable is required"
  echo "Example: SUPABASE_DB_HOST=db.xxxxx.supabase.co"
  exit 1
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "Error: SUPABASE_DB_PASSWORD environment variable is required"
  exit 1
fi

# Optional: specify a specific export file, otherwise use the latest
EXPORT_DIR="./migrations"
if [ -n "$1" ]; then
  EXPORT_FILE="$1"
else
  EXPORT_FILE=$(ls -t "${EXPORT_DIR}"/sams_export_*.sql 2>/dev/null | head -1)
  if [ -z "$EXPORT_FILE" ]; then
    echo "Error: No export file found in ${EXPORT_DIR}/"
    echo "Run ./scripts/migrate-export.sh first"
    exit 1
  fi
  echo "Using latest export: ${EXPORT_FILE}"
fi

if [ ! -f "$EXPORT_FILE" ]; then
  echo "Error: Export file not found: ${EXPORT_FILE}"
  exit 1
fi

echo ""
echo "Importing to Supabase: ${SUPABASE_DB_HOST}/postgres"
echo "Source file: ${EXPORT_FILE}"
echo ""
echo "WARNING: This will overwrite existing data in Supabase!"
read -p "Continue? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Starting import..."

# Import to Supabase (port 5432 for direct connection, 6543 for pooler)
SUPABASE_PORT=${SUPABASE_DB_PORT:-5432}

PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h "$SUPABASE_DB_HOST" \
  -U postgres \
  -d postgres \
  -p "$SUPABASE_PORT" \
  -f "$EXPORT_FILE"

echo ""
echo "Import completed!"
echo ""
echo "Next steps:"
echo "1. Update your server/.env with the Supabase DATABASE_URL"
echo "2. Run: cd server && npm run db:init (to apply any missing migrations)"
echo "3. Test the application"
