"""Seed one test login per RBAC role.

Creates (or repairs) three accounts so each role can be exercised end to end:

    super.admin@taxvault.in / SuperAdmin@123   super_admin
    admin@taxvault.in       / Admin@123        admin
    user@taxvault.in        / User@123         user

All three see the *same* vault - the one owned by the earliest-created super
admin (see ``dependencies.get_vault_owner_id``) - so the admin and user logins
open onto the real data rather than an empty account. If the deployment already
has a super admin, that account keeps ownership and the seeded super admin is
simply another full-access login.

The domain is a real one on purpose: the API validates addresses with
`EmailStr`, which refuses reserved TLDs such as `.test` or `.local`, so an
account seeded on those could never sign in.

Idempotent: re-running resets each seeded account's password and role rather
than creating duplicates. Existing non-seeded accounts are never touched.

Usage (from backend/):
    python scripts/seed_rbac_users.py
    python scripts/seed_rbac_users.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402

from app.core.permissions import (  # noqa: E402
    ROLE_ADMIN,
    ROLE_SUPER_ADMIN,
    ROLE_USER,
    permissions_for,
)
from app.core.security import hash_password  # noqa: E402

# Reuse the app's session factory rather than building an engine here: it
# already carries the pgbouncer/Supabase connect args a pooled DATABASE_URL
# needs (see app/db/session.py).
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.models.user import User  # noqa: E402

SEED_USERS = [
    {
        "email": "super.admin@taxvault.in",
        "password": "SuperAdmin@123",
        "full_name": "Test Super Admin",
        "phone_number": "+919000000001",
        "role": ROLE_SUPER_ADMIN,
    },
    {
        "email": "admin@taxvault.in",
        "password": "Admin@123",
        "full_name": "Test Admin",
        "phone_number": "+919000000002",
        "role": ROLE_ADMIN,
    },
    {
        "email": "user@taxvault.in",
        "password": "User@123",
        "full_name": "Test User",
        "phone_number": "+919000000003",
        "role": ROLE_USER,
    },
]


async def seed(dry_run: bool) -> None:
    async with AsyncSessionLocal() as db:
        for spec in SEED_USERS:
            existing = await db.scalar(select(User).where(User.email == spec["email"]))
            action = "update" if existing else "create"
            perms = len(permissions_for(spec["role"]))
            print(
                f"  [{action:6}] {spec['email']:28} role={spec['role']:12} "
                f"password={spec['password']:15} ({perms} permissions)"
            )
            if dry_run:
                continue

            if existing:
                existing.hashed_password = hash_password(spec["password"])
                existing.role = spec["role"]
                existing.is_active = True
            else:
                db.add(
                    User(
                        email=spec["email"],
                        hashed_password=hash_password(spec["password"]),
                        full_name=spec["full_name"],
                        phone_number=spec["phone_number"],
                        role=spec["role"],
                        is_active=True,
                    )
                )

        if not dry_run:
            await db.commit()

        owner = await db.scalar(
            select(User)
            .where(User.role == ROLE_SUPER_ADMIN, User.is_active == True)  # noqa: E712
            .order_by(User.created_at.asc())
            .limit(1)
        )
        if owner is not None:
            print(f"\n  Shared vault owner: {owner.email} ({owner.id})")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true", help="Show what would change without writing."
    )
    args = parser.parse_args()

    print("Seeding RBAC test logins" + (" (dry run)" if args.dry_run else ""))
    asyncio.run(seed(args.dry_run))
    print("\nDone." if not args.dry_run else "\nDry run complete - nothing written.")


if __name__ == "__main__":
    main()
