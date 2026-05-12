#!/bin/bash
# ============================================================
# SAMS - Quick migration using DATABASE_URL connection strings
# Usage: ./scripts/migrate-quick.sh
# ============================================================

set -e

echo "=== SAMS Quick Migration (Render -> Supabase) ==="
echo ""

if [ -z "$RENDER_DATABASE_URL" ]; then
  echo "Error: RENDER_DATABASE_URL environment variable is required"
  echo "Get this from your Render dashboard -> Environment variables"
  exit 1
fi

if [ -z "$SUPABASE_DATABASE_URL" ]; then
  echo "Error: SUPABASE_DATABASE_URL environment variable is required"
  echo "Get this from Supabase dashboard -> Settings -> Database -> Connection string (URI)"
  exit 1
fi

EXPORT_DIR="./migrations"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="${EXPORT_DIR}/sams_quick_${TIMESTAMP}.dump"

mkdir -p "$EXPORT_DIR"

echo "Step 1: Exporting from Render..."
pg_dump \
  "$RENDER_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  -f "$EXPORT_FILE"

echo ""
echo "Step 2: Importing to Supabase..."

# Use pg_restore with Supabase connection
# Note: Supabase uses port 6543 for connection pooling (transaction mode)
# For full restore, use port 5432 (direct connection)
SUPABASE_DIRECT_URL="${SUPABASE_DATABASE_URL/:6543/:5432}"

pg_restore \
  --no-owner \
  --no-acl \
  --verbose \
  --dbname="$SUPABASE_DIRECT_URL" \
  "$EXPORT_FILE"

echo ""
echo "Migration completed!"
echo ""
echo "Update your server/.env:"
echo "DATABASE_URL=${SUPABASE_DATABASE_URL}"
