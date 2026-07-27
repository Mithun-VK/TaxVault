"""Read-only verification script for TaxVault client data (Inigo Irudayaraj).

Checks:
  1. Record counts per entity type
  2. Five soonest upcoming due dates across all payable types
  3. Payables that have no AlertConfig (alert-gap detection)
  4. Assets with no linked tax obligation
  5. Full asset list with tax-obligation counts

Usage (run from backend/):
    python scripts/verify_client_data.py
"""

from __future__ import annotations

import asyncio
import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import func, select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.alert_config import AlertConfig  # noqa: E402
from app.models.asset import Asset  # noqa: E402
from app.models.insurance import InsurancePolicy  # noqa: E402
from app.models.recurring_bill import RecurringBill  # noqa: E402
from app.models.tax_obligation import TaxObligation  # noqa: E402
from app.models.user import User  # noqa: E402

CLIENT_EMAIL = "inigo@taxvault.in"
TODAY = date.today()


def _bar(char: str = "═", width: int = 62) -> str:
    return char * width


async def run() -> None:
    async with AsyncSessionLocal() as session:
        # ── Resolve client user ────────────────────────────────────────────
        user = (
            await session.execute(select(User).where(User.email == CLIENT_EMAIL))
        ).scalar_one_or_none()
        if not user:
            print(f"ERROR: user {CLIENT_EMAIL!r} not found. Run seed_client_data.py first.")
            sys.exit(1)
        uid = user.id

        # ── 1. Record counts ───────────────────────────────────────────────
        def count(col):
            return func.count(col)

        n_assets = (await session.execute(select(count(Asset.id)).where(Asset.user_id == uid))).scalar_one()
        n_taxes = (await session.execute(select(count(TaxObligation.id)).where(TaxObligation.user_id == uid))).scalar_one()
        n_bills = (await session.execute(select(count(RecurringBill.id)).where(RecurringBill.user_id == uid))).scalar_one()
        n_ins = (await session.execute(select(count(InsurancePolicy.id)).where(InsurancePolicy.user_id == uid))).scalar_one()
        n_alerts = (await session.execute(select(count(AlertConfig.id)).where(AlertConfig.user_id == uid))).scalar_one()

        print()
        print(_bar())
        print(f" TaxVault Data Verification — {CLIENT_EMAIL}")
        print(_bar())
        print(f" User:               {user.full_name}  ({user.email})")
        print(f" Assets:             {n_assets}")
        print(f" Tax obligations:    {n_taxes}")
        print(f" Recurring bills:    {n_bills}")
        print(f" Insurance policies: {n_ins}")
        print(f" Alert configs:      {n_alerts}")
        print(_bar())

        # ── 2. Five soonest upcoming due dates ─────────────────────────────
        print()
        print(" 5 SOONEST UPCOMING DUE DATES")
        print(_bar("-"))

        upcoming: list[tuple[date, str, str]] = []

        taxes = (await session.execute(
            select(TaxObligation.description, TaxObligation.due_date)
            .where(TaxObligation.user_id == uid, TaxObligation.due_date >= TODAY)
            .order_by(TaxObligation.due_date)
            .limit(10)
        )).all()
        for row in taxes:
            upcoming.append((row.due_date, "tax", row.description or "–"))

        bills = (await session.execute(
            select(RecurringBill.notes, RecurringBill.next_due_date)
            .where(RecurringBill.user_id == uid, RecurringBill.next_due_date >= TODAY, RecurringBill.is_active.is_(True))
            .order_by(RecurringBill.next_due_date)
            .limit(10)
        )).all()
        for row in bills:
            upcoming.append((row.next_due_date, "bill", row.notes or "–"))

        ins_rows = (await session.execute(
            select(InsurancePolicy.notes, InsurancePolicy.next_premium_date)
            .where(InsurancePolicy.user_id == uid, InsurancePolicy.next_premium_date >= TODAY)
            .order_by(InsurancePolicy.next_premium_date)
            .limit(10)
        )).all()
        for row in ins_rows:
            if row.next_premium_date:
                upcoming.append((row.next_premium_date, "insurance", row.notes or "–"))

        upcoming.sort(key=lambda x: x[0])
        for due, kind, name in upcoming[:5]:
            days_away = (due - TODAY).days
            print(f"  {due}  [{kind:<9}]  {days_away:>4}d  {name[:55]}")

        if not upcoming:
            print("  (no upcoming due dates found)")

        # ── 3. Alert-gap detection ─────────────────────────────────────────
        print()
        print(" PAYABLES WITH NO ALERT CONFIG")
        print(_bar("-"))
        gaps: list[tuple[str, str]] = []

        all_taxes = (await session.execute(
            select(TaxObligation.id, TaxObligation.description).where(TaxObligation.user_id == uid)
        )).all()
        for row in all_taxes:
            cfg = (await session.execute(
                select(AlertConfig.id).where(AlertConfig.user_id == uid, AlertConfig.entity_type == "tax", AlertConfig.entity_id == row.id)
            )).first()
            if not cfg:
                gaps.append(("tax", row.description or str(row.id)))

        all_bills = (await session.execute(
            select(RecurringBill.id, RecurringBill.notes).where(RecurringBill.user_id == uid)
        )).all()
        for row in all_bills:
            cfg = (await session.execute(
                select(AlertConfig.id).where(AlertConfig.user_id == uid, AlertConfig.entity_type == "bill", AlertConfig.entity_id == row.id)
            )).first()
            if not cfg:
                gaps.append(("bill", row.notes or str(row.id)))

        all_ins = (await session.execute(
            select(InsurancePolicy.id, InsurancePolicy.notes).where(InsurancePolicy.user_id == uid)
        )).all()
        for row in all_ins:
            cfg = (await session.execute(
                select(AlertConfig.id).where(AlertConfig.user_id == uid, AlertConfig.entity_type == "insurance", AlertConfig.entity_id == row.id)
            )).first()
            if not cfg:
                gaps.append(("insurance", row.notes or str(row.id)))

        if gaps:
            for kind, name in gaps:
                print(f"  MISSING [{kind:<9}]  {name[:60]}")
        else:
            print("  All payables have alert configs. ✓")

        # ── 4. Assets with no linked tax obligation ────────────────────────
        print()
        print(" ASSETS WITH NO LINKED TAX OBLIGATION")
        print(_bar("-"))

        all_assets = (await session.execute(
            select(Asset.id, Asset.name, Asset.asset_type).where(Asset.user_id == uid)
        )).all()

        untaxed = []
        for asset in all_assets:
            tax_count = (await session.execute(
                select(count(TaxObligation.id)).where(
                    TaxObligation.user_id == uid, TaxObligation.asset_id == asset.id
                )
            )).scalar_one()
            if tax_count == 0:
                untaxed.append((asset.asset_type, asset.name))

        if untaxed:
            for atype, aname in untaxed:
                print(f"  [{atype:<10}]  {aname}")
        else:
            print("  All assets have at least one linked tax obligation. ✓")

        # ── 5. Full asset list with tax counts ─────────────────────────────
        print()
        print(" FULL ASSET LIST (name · type · linked taxes)")
        print(_bar("-"))

        for asset in all_assets:
            tax_count = (await session.execute(
                select(count(TaxObligation.id)).where(
                    TaxObligation.user_id == uid, TaxObligation.asset_id == asset.id
                )
            )).scalar_one()
            taxes_label = f"{tax_count} tax(es)" if tax_count else "no taxes"
            print(f"  [{asset.asset_type:<10}]  {asset.name:<55}  {taxes_label}")

        print()
        print(_bar())
        print()


def count(col):
    return func.count(col)


if __name__ == "__main__":
    asyncio.run(run())
