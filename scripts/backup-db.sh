#!/usr/bin/env bash
# Back up the self-hosted TaxVault stack: Postgres dump + the uploads volume.
#
#   ./scripts/backup-db.sh [output-dir]     # default: ./backups
#
# Once you self-host, this script is the only thing standing between you and
# total data loss. Schedule it (Task Scheduler / cron) and copy the output off
# this machine — a backup on the same disk as the database is not a backup.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env.selfhost"
OUT_DIR="${1:-$ROOT/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC2046
export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" | xargs)
PGUSER="${POSTGRES_USER:-taxvault}"
PGDB="${POSTGRES_DB:-taxvault}"

mkdir -p "$OUT_DIR"

DUMP="$OUT_DIR/taxvault-$STAMP.dump"
FILES="$OUT_DIR/uploads-$STAMP.tar.gz"

echo "==> Dumping database $PGDB"
# Custom format (-Fc): compressed, and restorable table-by-table with pg_restore.
docker exec -i tv-postgres pg_dump -U "$PGUSER" -d "$PGDB" -Fc --no-owner --no-privileges > "$DUMP"

echo "==> Archiving uploaded documents"
# A throwaway container is the only way to read a named volume from the host.
docker run --rm \
  -v taxvault-selfhost_uploads:/uploads:ro \
  -v "$OUT_DIR:/backup" \
  alpine:3.20 tar czf "/backup/$(basename "$FILES")" -C /uploads .

echo "==> Pruning backups older than ${KEEP_DAYS}d"
find "$OUT_DIR" -maxdepth 1 -name 'taxvault-*.dump' -mtime "+$KEEP_DAYS" -delete
find "$OUT_DIR" -maxdepth 1 -name 'uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo
echo "Done:"
ls -lh "$DUMP" "$FILES"
echo
echo "Copy these off this machine (external drive / cloud) — that is the backup."
