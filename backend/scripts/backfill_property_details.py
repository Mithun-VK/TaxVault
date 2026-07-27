"""Backfill the Property Details columns on ``assets`` from ``asset_metadata``.

Maps legacy metadata keys to the canonical columns (e.g. location -> address,
sro -> registration_office, tneb_numbers -> eb_numbers) and joins multi-value
arrays (patta_numbers, deed_numbers, tneb_numbers, …) into comma-separated text.

Idempotent: only fills a column when it is currently NULL, so re-running or
editing a record afterwards will not clobber newer values.

Usage (from backend/):
    python scripts/backfill_property_details.py
    python scripts/backfill_property_details.py --dry-run
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

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.config import settings  # noqa: E402

# canonical column -> ordered metadata keys to try (first non-empty wins).
FIELD_ALIASES: dict[str, list[str]] = {
    "owner_name": ["owner_name", "owner"],
    "address": ["address", "location"],
    "deed_number": ["deed_number", "deed_numbers", "deed_no"],
    "deed_date": ["deed_date", "deed_dates"],
    "registration_office": ["registration_office", "sro", "revenue_office", "registration_number"],
    "survey_number": ["survey_number", "survey_numbers", "survey_no", "survey_nos"],
    "land_area": ["land_area", "extent_sqft", "extent", "extent_sq_ft"],
    "patta_number": ["patta_number", "patta_numbers", "pattam", "new_pattam", "patta"],
    "chitta": ["chitta", "chitta_number"],
    "adangal": ["adangal", "adangal_number"],
    "eb_numbers": ["eb_numbers", "tneb_numbers", "tneb_number", "eb_number", "eb_no", "eb_nos"],
}


def _display(v: object) -> str | None:
    if v is None:
        return None
    if isinstance(v, list):
        parts = [str(x).strip() for x in v if str(x).strip()]
        return ", ".join(parts) or None
    s = str(v).strip()
    return s or None


def _resolve(md: dict, aliases: list[str]) -> str | None:
    for a in aliases:
        val = _display(md.get(a))
        if val is not None:
            return val
    return None


async def run(dry_run: bool) -> None:
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__bf_{uuid4().hex}__",
        },
    )
    updated = 0
    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    "SELECT id, asset_metadata, owner_name, address, deed_number, deed_date, "
                    "registration_office, survey_number, land_area, patta_number, chitta, "
                    "adangal, eb_numbers FROM assets"
                )
            )
        ).mappings().all()

        for row in rows:
            md = row["asset_metadata"] or {}
            patch: dict[str, str] = {}
            for col, aliases in FIELD_ALIASES.items():
                if row[col] not in (None, ""):
                    continue  # already set — don't clobber
                val = _resolve(md, aliases)
                if val is not None:
                    patch[col] = val
            if not patch:
                continue
            updated += 1
            print(f"  {row['id']}: {', '.join(f'{k}={v!r}' for k, v in patch.items())}")
            if not dry_run:
                sets = ", ".join(f"{k} = :{k}" for k in patch)
                await conn.execute(
                    text(f"UPDATE assets SET {sets} WHERE id = :id"),
                    {**patch, "id": row["id"]},
                )
        if not dry_run:
            await conn.commit()

    await engine.dispose()
    print(f"\n{'(dry-run) would update' if dry_run else 'Updated'} {updated} rows.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    main()
