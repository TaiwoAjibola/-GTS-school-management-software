#!/bin/bash
# ============================================================
# SAMS - Export data from Render PostgreSQL
# Usage: ./scripts/migrate-export.sh
# ============================================================

set -e

echo "=== SAMS Database Export (Render -> Supabase) ==="

# Check for required environment variables
if [ -z "$RENDER_DB_HOST" ]; then
  echo "Error: RENDER_DB_HOST environment variable is required"
  echo "Example: RENDER_DB_HOST=dpg-xxxxx.a.render.com"
  exit 1
fi

if [ -z "$RENDER_DB_USER" ]; then
  echo "Error: RENDER_DB_USER environment variable is required"
  exit 1
fi

if [ -z "$RENDER_DB_NAME" ]; then
  echo "Error: RENDER_DB_NAME environment variable is required"
  exit 1
fi

if [ -z "$RENDER_DB_PASSWORD" ]; then
  echo "Error: RENDER_DB_PASSWORD environment variable is required"
  exit 1
fi

EXPORT_DIR="./migrations"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="${EXPORT_DIR}/sams_export_${TIMESTAMP}.sql"

mkdir -p "$EXPORT_DIR"

echo "Exporting from Render database: ${RENDER_DB_HOST}/${RENDER_DB_NAME}"
echo "Output file: ${EXPORT_FILE}"

# Export schema + data (no owner/acl for Supabase compatibility)
PGPASSWORD="$RENDER_DB_PASSWORD" pg_dump \
  -h "$RENDER_DB_HOST" \
  -U "$RENDER_DB_USER" \
  -d "$RENDER_DB_NAME" \
  -p 5432 \
  --no-owner \
  --no-acl \
  --no-privileges \
  --clean \
  --if-exists \
  --create \
  --verbose \
  -f "$EXPORT_FILE"

echo ""
echo "Export completed successfully!"
echo "File size: $(du -h "$EXPORT_FILE" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Review the export file: ${EXPORT_FILE}"
echo "2. Run the import script: ./scripts/migrate-import.sh"
