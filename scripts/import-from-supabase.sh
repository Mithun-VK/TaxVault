#!/usr/bin/env bash
# One-time: copy the live Supabase database into the self-hosted Postgres.
#
#   ./scripts/import-from-supabase.sh
#
# Reads DIRECT_DATABASE_URL from backend/.env (the existing Supabase config) and
# loads it into the tv-postgres container. Run this ONCE, before the first
# `up -d` of the full stack — see SELFHOSTING.md step 5.
#
# Read-only against Supabase. Destructive against the local database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_ENV="$ROOT/backend/.env"
DST_ENV="$ROOT/backend/.env.selfhost"
OUT_DIR="$ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$OUT_DIR/supabase-$STAMP.dump"

[ -f "$SRC_ENV" ] || { echo "missing $SRC_ENV (source Supabase config)" >&2; exit 1; }
[ -f "$DST_ENV" ] || { echo "missing $DST_ENV — copy .env.selfhost.example first" >&2; exit 1; }

# Prefer the direct (non-pooler) URL: pgBouncer at :6543 breaks pg_dump.
SRC_URL="$(grep -E '^DIRECT_DATABASE_URL=' "$SRC_ENV" | tail -1 | cut -d= -f2-)"
[ -n "$SRC_URL" ] || { echo "DIRECT_DATABASE_URL not set in $SRC_ENV" >&2; exit 1; }
# pg_dump is libpq — it does not understand SQLAlchemy's '+asyncpg' suffix.
SRC_URL="${SRC_URL/+asyncpg/}"

# shellcheck disable=SC2046
export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "$DST_ENV" | xargs)
PGUSER="${POSTGRES_USER:-taxvault}"
PGDB="${POSTGRES_DB:-taxvault}"

docker inspect tv-postgres >/dev/null 2>&1 || {
  echo "tv-postgres is not running. Start it first:" >&2
  echo "  docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d postgres" >&2
  exit 1
}

mkdir -p "$OUT_DIR"

echo "==> Dumping Supabase (public schema only)"
# -n public skips Supabase's auth/storage/realtime schemas, which reference
# roles that do not exist locally. --no-owner/--no-privileges drops the
# supabase_admin GRANTs for the same reason.
docker run --rm -i postgres:16 \
  pg_dump "$SRC_URL" -Fc -n public --no-owner --no-privileges > "$DUMP"

echo "    wrote $DUMP ($(du -h "$DUMP" | cut -f1))"

echo
echo "About to WIPE the local database '$PGDB' and load that dump."
read -r -p "Type 'import' to continue: " CONFIRM
[ "$CONFIRM" = "import" ] || { echo "aborted (dump kept at $DUMP)"; exit 1; }

echo "==> Recreating local schema"
docker exec -i tv-postgres psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'

echo "==> Loading"
# Warnings about missing roles/extensions are expected and harmless here.
docker exec -i tv-postgres pg_restore -U "$PGUSER" -d "$PGDB" \
  --no-owner --no-privileges --no-acl < "$DUMP" || true

echo "==> Verifying"
docker exec -i tv-postgres psql -U "$PGUSER" -d "$PGDB" -c \
  "SELECT version_num AS alembic_head FROM alembic_version;"
docker exec -i tv-postgres psql -U "$PGUSER" -d "$PGDB" -c \
  "SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables
   WHERE n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 20;"

echo
echo "The dump carried alembic_version across, so 'alembic upgrade head' on the"
echo "next start will be a no-op unless you have newer migrations. Bring up the"
echo "rest of the stack:"
echo "  docker compose -f docker-compose.selfhost.yml --env-file backend/.env.selfhost up -d --build"
