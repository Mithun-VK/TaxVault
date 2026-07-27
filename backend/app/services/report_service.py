import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import EntityType
from app.core.display_names import (
    bill_display_name,
    insurance_display_name,
    tax_display_name,
)
from app.models.asset import Asset
from app.models.insurance import InsurancePolicy
from app.models.payment import Payment
from app.models.recurring_bill import RecurringBill
from app.models.tax_obligation import TaxObligation
from app.schemas.report import (
    AssetRegisterReport,
    AssetRegisterRow,
    PayableReportRow,
    PayablesReport,
)


async def _entity_index(
    db: AsyncSession, user_id: uuid.UUID, entity_type: str
) -> dict[uuid.UUID, tuple[str, str | None]]:
    """id -> (display name, subtype) for every payable of a given type."""
    index: dict[uuid.UUID, tuple[str, str | None]] = {}
    if entity_type == EntityType.bill.value:
        rows = (
            (await db.execute(select(RecurringBill).where(RecurringBill.user_id == user_id)))
            .scalars()
            .all()
        )
        for b in rows:
            index[b.id] = (bill_display_name(b), b.bill_type)
    elif entity_type == EntityType.tax.value:
        rows = (
            (
                await db.execute(
                    select(TaxObligation).where(
                        TaxObligation.user_id == user_id, TaxObligation.is_archived == False
                    )
                )
            )
            .scalars()
            .all()
        )
        for t in rows:
            index[t.id] = (tax_display_name(t), t.tax_type)
    elif entity_type == EntityType.insurance.value:
        rows = (
            (await db.execute(select(InsurancePolicy).where(InsurancePolicy.user_id == user_id)))
            .scalars()
            .all()
        )
        for p in rows:
            index[p.id] = (insurance_display_name(p), p.insurance_type)
    return index


async def payables_report(
    db: AsyncSession, user_id: uuid.UUID, entity_type: str, year: int
) -> PayablesReport:
    """Month-by-month spend per payable for a year — the pivot behind the
    Bills / Taxes / Insurance report tabs and their variance columns."""
    index = await _entity_index(db, user_id, entity_type)

    month_col = func.extract("month", Payment.payment_date)
    grouped = await db.execute(
        select(Payment.entity_id, month_col, func.coalesce(func.sum(Payment.amount_paid), 0))
        .where(
            Payment.user_id == user_id,
            Payment.entity_type == entity_type,
            func.extract("year", Payment.payment_date) == year,
        )
        .group_by(Payment.entity_id, month_col)
    )

    by_entity: dict[uuid.UUID, dict[int, Decimal]] = {}
    for entity_id, month, total in grouped:
        by_entity.setdefault(entity_id, {})[int(month)] = Decimal(str(total))

    # Row set = all current payables plus any entity that received a payment this
    # year (covers payments logged against since-deleted payables).
    entity_ids = set(index.keys()) | set(by_entity.keys())

    rows: list[PayableReportRow] = []
    for entity_id in entity_ids:
        months = by_entity.get(entity_id, {})
        name, subtype = index.get(entity_id, ("(deleted)", None))
        rows.append(
            PayableReportRow(
                entity_id=entity_id,
                entity_name=name,
                entity_type=entity_type,
                subtype=subtype,
                months=months,
                total=sum(months.values(), Decimal("0")),
            )
        )

    rows.sort(key=lambda r: r.total, reverse=True)
    return PayablesReport(year=year, entity_type=entity_type, rows=rows)


async def asset_register(
    db: AsyncSession, user_id: uuid.UUID, vehicle_only: bool
) -> AssetRegisterReport:
    """Inventory of assets (or just vehicles) with rolled-up tax and premium
    spend attached to each."""
    q = select(Asset).where(Asset.user_id == user_id, Asset.is_archived == False)
    if vehicle_only:
        q = q.where(Asset.asset_type == "vehicle")
    assets = (await db.execute(q)).scalars().all()

    rows: list[AssetRegisterRow] = []
    for a in assets:
        tax_ids = (
            (
                await db.execute(
                    select(TaxObligation.id).where(
                        TaxObligation.asset_id == a.id, TaxObligation.user_id == user_id
                    )
                )
            )
            .scalars()
            .all()
        )
        policy_ids = (
            (
                await db.execute(
                    select(InsurancePolicy.id).where(
                        InsurancePolicy.asset_id == a.id, InsurancePolicy.user_id == user_id
                    )
                )
            )
            .scalars()
            .all()
        )

        taxes_paid = Decimal("0")
        if tax_ids:
            taxes_paid = Decimal(
                str(
                    (
                        await db.execute(
                            select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
                                Payment.user_id == user_id,
                                Payment.entity_type == EntityType.tax.value,
                                Payment.entity_id.in_(tax_ids),
                            )
                        )
                    ).scalar_one()
                )
            )

        premiums_paid = Decimal("0")
        if policy_ids:
            premiums_paid = Decimal(
                str(
                    (
                        await db.execute(
                            select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
                                Payment.user_id == user_id,
                                Payment.entity_type == EntityType.insurance.value,
                                Payment.entity_id.in_(policy_ids),
                            )
                        )
                    ).scalar_one()
                )
            )

        rows.append(
            AssetRegisterRow(
                id=a.id,
                name=a.name,
                asset_type=a.asset_type,
                status=a.status,
                acquisition_date=a.acquisition_date,
                acquisition_cost=Decimal(str(a.acquisition_cost)) if a.acquisition_cost else None,
                current_value=Decimal(str(a.current_value)) if a.current_value else None,
                taxes_paid=taxes_paid,
                premiums_paid=premiums_paid,
            )
        )

    rows.sort(key=lambda r: (r.current_value or Decimal("0")), reverse=True)
    return AssetRegisterReport(rows=rows)
