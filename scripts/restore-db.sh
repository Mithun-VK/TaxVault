#!/usr/bin/env bash
# Restore a TaxVault backup into the self-hosted stack.
#
#   ./scripts/restore-db.sh backups/taxvault-20260727-100000.dump \
#                           [backups/uploads-20260727-100000.tar.gz]
#
# DESTRUCTIVE: drops and recreates the public schema before restoring.
# Stop the app first so nothing writes mid-restore:
#   docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost \
#     stop api worker beat
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env.selfhost"
DUMP="${1:-}"
FILES="${2:-}"

[ -n "$DUMP" ] || { echo "usage: $0 <dump-file> [uploads-tar-gz]" >&2; exit 1; }
[ -f "$DUMP" ]  || { echo "no such dump: $DUMP" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC2046
export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$ENV_FILE" | xargs)
PGUSER="${POSTGRES_USER:-taxvault}"
PGDB="${POSTGRES_DB:-taxvault}"

echo "About to WIPE database '$PGDB' and restore from $DUMP"
read -r -p "Type 'restore' to continue: " CONFIRM
[ "$CONFIRM" = "restore" ] || { echo "aborted"; exit 1; }

echo "==> Recreating schema"
docker exec -i tv-postgres psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

echo "==> Restoring database"
# Exit status is ignored on purpose: pg_restore warns about absent roles and
# extension ownership even on a clean restore. Trust the verification below.
docker exec -i tv-postgres pg_restore -U "$PGUSER" -d "$PGDB" \
  --no-owner --no-privileges --no-acl < "$DUMP" || true

if [ -n "$FILES" ]; then
  [ -f "$FILES" ] || { echo "no such uploads archive: $FILES" >&2; exit 1; }
  echo "==> Restoring uploaded documents"
  docker run --rm \
    -v taxvault-selfhost_uploads:/uploads \
    -v "$(cd "$(dirname "$FILES")" && pwd):/backup:ro" \
    alpine:3.20 sh -c "rm -rf /uploads/* && tar xzf /backup/$(basename "$FILES") -C /uploads"
fi

echo "==> Verifying"
docker exec -i tv-postgres psql -U "$PGUSER" -d "$PGDB" -c \
  "SELECT version_num AS alembic_head FROM alembic_version;"
docker exec -i tv-postgres psql -U "$PGUSER" -d "$PGDB" -c \
  "SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema='public';"

echo
echo "Restore complete. Start the app:"
echo "  docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d"
