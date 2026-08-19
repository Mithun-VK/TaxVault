"""Seed the client's known business entities.

The five entities below are the ones that appear in the client's Payable
Calendar. Registration numbers are left blank on purpose - they are filled in
from the actual certificates through the UI; what matters here is that each
entity exists with the right legal form, so bills, taxes and properties have
something to hang off.

Idempotent: matches on (user_id, legal_name) and skips anything already there,
so re-running is safe against the live database.

Usage (from backend/):
    python scripts/seed_companies.py
    python scripts/seed_companies.py --dry-run
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

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.permissions import ROLE_SUPER_ADMIN  # noqa: E402
from app.models.company import Company  # noqa: E402
from app.models.user import User  # noqa: E402

COMPANIES_SEED: list[dict] = [
    {
        "legal_name": "Fashion Profiles",
        "company_type": "proprietorship",
        "industry": "Textile / Garment Export",
        "status": "active",
        "other_registrations": [
            {"name": "AEPC Registration", "number": ""},
            {"name": "Textiles Committee", "number": ""},
            {"name": "FSSAI License", "number": ""},
            {"name": "Import Export Code", "number": ""},
        ],
    },
    {
        "legal_name": "Causeway Bay",
        "company_type": "other",
        "industry": "Textile / Garment Export",
        "status": "active",
        "other_registrations": [
            {"name": "AEPC Registration", "number": ""},
            {"name": "Textiles Committee", "number": ""},
        ],
    },
    {
        "legal_name": "Allwyn Farms",
        "company_type": "proprietorship",
        "industry": "Agriculture",
        "status": "active",
        "other_registrations": [],
    },
    {
        "legal_name": "JAFZA Entity",
        "company_type": "foreign_subsidiary",
        "industry": "Trading",
        "status": "active",
        "foreign_jurisdiction": "JAFZA, Dubai, UAE",
        # UAE-aligned entities commonly close their books in September.
        "financial_year_end": "09-30",
        "other_registrations": [
            {"name": "JAFZA Trading License", "number": ""},
        ],
    },
    {
        "legal_name": "CNI - Christhava Nalleeniya Iyakkam",
        "trade_name": "CNI",
        "company_type": "trust",
        "industry": "Religious / Charitable Trust",
        "status": "active",
        "other_registrations": [
            {"name": "12A Registration", "number": ""},
        ],
    },
]


def _make_engine():
    # Dedicated engine: NullPool + unique prepared-statement names, so the
    # script works through Supabase's pgbouncer transaction pooler.
    return create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__seed_{uuid4().hex}__",
        },
    )


async def _vault_owner_id(db):
    """The account every vault record hangs off - see get_vault_owner_id()."""
    owner_id = await db.scalar(
        select(User.id)
        .where(User.role == ROLE_SUPER_ADMIN, User.is_active == True)  # noqa: E712
        .order_by(User.created_at.asc())
        .limit(1)
    )
    if owner_id is None:
        owner_id = await db.scalar(select(User.id).order_by(User.created_at.asc()).limit(1))
    return owner_id


async def run(dry_run: bool) -> None:
    engine = _make_engine()
    session_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async with session_factory() as db:
        user_id = await _vault_owner_id(db)
        if user_id is None:
            print("No users found - run scripts/seed_rbac_users.py first.")
            await engine.dispose()
            return
        print(f"Vault owner: {user_id}")

        created = 0
        for spec in COMPANIES_SEED:
            existing = await db.scalar(
                select(Company.id).where(
                    Company.user_id == user_id,
                    Company.legal_name == spec["legal_name"],
                )
            )
            if existing:
                print(f"  = exists: {spec['legal_name']}")
                continue

            print(f"  + create: {spec['legal_name']}  ({spec['company_type']})")
            if not dry_run:
                db.add(
                    Company(
                        user_id=user_id,
                        bank_accounts=[],
                        directors=[],
                        **spec,
                    )
                )
                created += 1

        if not dry_run:
            await db.commit()

        rows = (
            await db.execute(
                select(Company.legal_name, Company.company_type, Company.status)
                .where(Company.user_id == user_id, Company.is_archived == False)  # noqa: E712
                .order_by(Company.legal_name)
            )
        ).all()
        print(f"\nCreated {created}. Companies now in vault: {len(rows)}")
        for name, ctype, status in rows:
            print(f"  · {name}  [{ctype}] {status}")
        if dry_run:
            print("(dry-run - no changes written)")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="print plan, write nothing")
    args = parser.parse_args()
    asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    main()
