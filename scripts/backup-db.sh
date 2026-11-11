#!/usr/bin/env bash
# Local backup of the PRGB database (the Supabase Free plan has no downloadable backups).
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://...'   # Project Settings > Database > Connection string (needs the DB password)
#   export BACKUP_DIR='D:/backups/prgb'          # a folder OUTSIDE this repository
#   scripts/backup-db.sh
#
# The dump holds nicknames and scores (personal data): keep it encrypted, never commit it, and let the
# script delete copies older than 30 days (the retention the privacy policy promises).
# Needs the Supabase CLI (`supabase`) on PATH. Not tested against the real project yet: see docs/operacao.md.
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (see the header of this script)}"
: "${BACKUP_DIR:?Set BACKUP_DIR to a folder outside the repository}"

mkdir -p "$BACKUP_DIR"
if git -C "$BACKUP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "BACKUP_DIR is inside a git repository: choose a folder outside it." >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$BACKUP_DIR/schema-$stamp.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f "$BACKUP_DIR/data-$stamp.sql"

# Retention: 30 days, only files this script created
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'schema-*.sql' -o -name 'data-*.sql' \) -mtime +30 -delete

echo "Backup written to $BACKUP_DIR ($stamp). Encrypt it before storing."
