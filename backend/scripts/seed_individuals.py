"""Seed Individual profiles from existing asset ownership.

For every distinct ``asset_metadata->>'owner_name'`` found on a user's assets,
ensure an Individual profile exists for that user, then back-link each asset to
its individual via ``assets.individual_id``.

Idempotent: re-running creates no duplicates and only fills in links that are
missing. Safe to run against the live database.

Usage (from backend/):
    python scripts/seed_individuals.py
    python scripts/seed_individuals.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select, text  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.models.individual import Individual  # noqa: E402

# Relationship-to-owner by (normalised) owner name. Anyone not listed is a
# generic family member.
RELATIONSHIP_BY_NAME = {
    "inigo irudayaraj": "Self",
    "felci rajam": "Spouse",
}
DEFAULT_RELATIONSHIP = "Family Member"


def _relationship_for(name: str) -> str:
    return RELATIONSHIP_BY_NAME.get(name.strip().lower(), DEFAULT_RELATIONSHIP)


def _make_engine():
    # Dedicated engine: NullPool + unique prepared-statement names so the script
    # works cleanly through Supabase's pgbouncer transaction pooler.
    return create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__seed_{uuid4().hex}__",
        },
    )


async def run(dry_run: bool) -> None:
    engine = _make_engine()
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async with session_factory() as db:
        # 1. Distinct (user_id, owner_name) across all non-archived assets.
        rows = (
            await db.execute(
                text(
                    "SELECT DISTINCT user_id, asset_metadata->>'owner_name' AS owner "
                    "FROM assets "
                    "WHERE is_archived = false "
                    "AND asset_metadata->>'owner_name' IS NOT NULL "
                    "AND asset_metadata->>'owner_name' <> ''"
                )
            )
        ).all()

        print(f"Found {len(rows)} distinct (user, owner) pairs.")
        created = 0
        for user_id, owner in rows:
            existing = (
                await db.execute(
                    select(Individual).where(
                        Individual.user_id == user_id,
                        Individual.full_name == owner,
                    )
                )
            ).scalar_one_or_none()

            if existing:
                print(f"  = exists: {owner}")
                continue

            rel = _relationship_for(owner)
            print(f"  + create: {owner}  ({rel})")
            if not dry_run:
                db.add(
                    Individual(
                        user_id=user_id,
                        full_name=owner,
                        relationship_to_owner=rel,
                        visas=[],
                    )
                )
                created += 1

        if not dry_run:
            await db.commit()

        # 2. Back-link assets to their individual by exact owner-name match.
        if not dry_run:
            result = await db.execute(
                text(
                    "UPDATE assets a "
                    "SET individual_id = i.id "
                    "FROM individuals i "
                    "WHERE i.user_id = a.user_id "
                    "AND i.full_name = a.asset_metadata->>'owner_name' "
                    "AND a.asset_metadata->>'owner_name' IS NOT NULL "
                    "AND (a.individual_id IS NULL OR a.individual_id <> i.id)"
                )
            )
            await db.commit()
            print(f"Linked assets updated: {result.rowcount}")

        # 3. Report.
        linked = (
            await db.execute(
                text("SELECT count(*) FROM assets WHERE individual_id IS NOT NULL")
            )
        ).scalar()
        total_ind = (
            await db.execute(text("SELECT count(*) FROM individuals"))
        ).scalar()
        print(f"Individuals total: {total_ind} | assets linked: {linked}")
        if dry_run:
            print("(dry-run — no changes written)")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="print plan, write nothing")
    args = parser.parse_args()
    asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    main()
