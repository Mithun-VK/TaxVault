import uuid
from datetime import date, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BillCycle, ObligationStatus, PremiumFrequency, RecurrenceRule
from app.core.display_names import (
    bill_display_name,
    insurance_display_name,
    tax_display_name,
)
from app.models.asset import Asset
from app.models.audit_log import AuditLog
from app.models.insurance import InsurancePolicy
from app.models.payment import Payment
from app.models.recurring_bill import RecurringBill
from app.models.tax_obligation import TaxObligation
from app.schemas.dashboard import (
    CalendarItem,
    CalendarYearItem,
    DashboardSummary,
    RecentActivity,
    UpcomingItem,
)


async def get_summary(db: AsyncSession, user_id: uuid.UUID) -> DashboardSummary:
    today = date.today()
    month_start = today.replace(day=1)
    month_end = (today.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

    # FY start: April 1 of current or previous year
    fy_start = date(today.year, 4, 1) if today.month >= 4 else date(today.year - 1, 4, 1)

    assets_val_q = select(func.coalesce(func.sum(Asset.current_value), 0)).where(
        Asset.user_id == user_id, Asset.is_archived == False
    )
    total_assets_value = Decimal(str((await db.execute(assets_val_q)).scalar_one()))

    tax_due = (
        await db.execute(
            select(func.count()).where(
                TaxObligation.user_id == user_id,
                TaxObligation.due_date >= month_start,
                TaxObligation.due_date <= month_end,
                TaxObligation.status == "pending",
            )
        )
    ).scalar_one()
    ins_due = (
        await db.execute(
            select(func.count()).where(
                InsurancePolicy.user_id == user_id,
                InsurancePolicy.next_premium_date >= month_start,
                InsurancePolicy.next_premium_date <= month_end,
                InsurancePolicy.status == "active",
            )
        )
    ).scalar_one()
    bill_due = (
        await db.execute(
            select(func.count()).where(
                RecurringBill.user_id == user_id,
                RecurringBill.next_due_date >= month_start,
                RecurringBill.next_due_date <= month_end,
                RecurringBill.is_active == True,
            )
        )
    ).scalar_one()
    due_this_month = tax_due + ins_due + bill_due

    overdue_tax = (
        await db.execute(
            select(func.count()).where(
                TaxObligation.user_id == user_id,
                TaxObligation.due_date < today,
                TaxObligation.status == "pending",
            )
        )
    ).scalar_one()
    overdue_ins = (
        await db.execute(
            select(func.count()).where(
                InsurancePolicy.user_id == user_id,
                InsurancePolicy.next_premium_date < today,
                InsurancePolicy.status == "active",
            )
        )
    ).scalar_one()
    overdue_bill = (
        await db.execute(
            select(func.count()).where(
                RecurringBill.user_id == user_id,
                RecurringBill.next_due_date < today,
                RecurringBill.is_active == True,
            )
        )
    ).scalar_one()
    overdue_count = overdue_tax + overdue_ins + overdue_bill

    paid_fy_q = select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
        Payment.user_id == user_id,
        Payment.payment_date >= fy_start,
    )
    total_paid_this_fy = Decimal(str((await db.execute(paid_fy_q)).scalar_one()))

    return DashboardSummary(
        total_assets_value=total_assets_value,
        due_this_month=due_this_month,
        overdue_count=overdue_count,
        total_paid_this_fy=total_paid_this_fy,
    )


async def get_upcoming(db: AsyncSession, user_id: uuid.UUID) -> list[UpcomingItem]:
    today = date.today()
    items: list[UpcomingItem] = []

    taxes = (
        (
            await db.execute(
                select(TaxObligation)
                .where(
                    TaxObligation.user_id == user_id,
                    TaxObligation.due_date >= today,
                    TaxObligation.status == "pending",
                    TaxObligation.is_archived == False,
                )
                .order_by(TaxObligation.due_date)
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    for t in taxes:
        items.append(
            UpcomingItem(
                entity_type="tax",
                entity_id=str(t.id),
                name=tax_display_name(t),
                amount=Decimal(str(t.total_amount)) if t.total_amount else None,
                due_date=t.due_date,
                days_remaining=(t.due_date - today).days,
            )
        )

    policies = (
        (
            await db.execute(
                select(InsurancePolicy)
                .where(
                    InsurancePolicy.user_id == user_id,
                    InsurancePolicy.next_premium_date >= today,
                    InsurancePolicy.status == "active",
                )
                .order_by(InsurancePolicy.next_premium_date)
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    for p in policies:
        if p.next_premium_date is None:
            continue
        items.append(
            UpcomingItem(
                entity_type="insurance",
                entity_id=str(p.id),
                name=insurance_display_name(p),
                amount=Decimal(str(p.premium_amount)),
                due_date=p.next_premium_date,
                days_remaining=(p.next_premium_date - today).days,
            )
        )

    bills = (
        (
            await db.execute(
                select(RecurringBill)
                .where(
                    RecurringBill.user_id == user_id,
                    RecurringBill.next_due_date >= today,
                    RecurringBill.is_active == True,
                )
                .order_by(RecurringBill.next_due_date)
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    for b in bills:
        items.append(
            UpcomingItem(
                entity_type="bill",
                entity_id=str(b.id),
                name=bill_display_name(b),
                amount=Decimal(str(b.average_amount)) if b.average_amount else None,
                due_date=b.next_due_date,
                days_remaining=(b.next_due_date - today).days,
            )
        )

    items.sort(key=lambda x: x.due_date)
    return items[:10]


async def get_recent_activity(db: AsyncSession, user_id: uuid.UUID) -> list[RecentActivity]:
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(15)
    )
    return [
        RecentActivity(
            action=a.action,
            entity_type=a.entity_type,
            entity_id=str(a.entity_id),
            created_at=a.created_at.isoformat(),
            user_id=str(a.user_id),
        )
        for a in result.scalars()
    ]


async def get_calendar(db: AsyncSession, user_id: uuid.UUID, month: str) -> list[CalendarItem]:
    try:
        year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    except (ValueError, IndexError):
        return []

    import calendar as cal_mod

    last_day = cal_mod.monthrange(year, mon)[1]
    start = date(year, mon, 1)
    end = date(year, mon, last_day)

    items: list[CalendarItem] = []

    taxes = (
        (
            await db.execute(
                select(TaxObligation).where(
                    TaxObligation.user_id == user_id,
                    TaxObligation.due_date >= start,
                    TaxObligation.due_date <= end,
                )
            )
        )
        .scalars()
        .all()
    )
    for t in taxes:
        items.append(
            CalendarItem(
                entity_type="tax",
                entity_id=str(t.id),
                name=tax_display_name(t),
                amount=Decimal(str(t.total_amount)) if t.total_amount else None,
                due_date=t.due_date,
            )
        )

    policies = (
        (
            await db.execute(
                select(InsurancePolicy).where(
                    InsurancePolicy.user_id == user_id,
                    InsurancePolicy.next_premium_date >= start,
                    InsurancePolicy.next_premium_date <= end,
                )
            )
        )
        .scalars()
        .all()
    )
    for p in policies:
        items.append(
            CalendarItem(
                entity_type="insurance",
                entity_id=str(p.id),
                name=insurance_display_name(p),
                amount=Decimal(str(p.premium_amount)),
                due_date=p.next_premium_date,
            )
        )

    bills = (
        (
            await db.execute(
                select(RecurringBill).where(
                    RecurringBill.user_id == user_id,
                    RecurringBill.next_due_date >= start,
                    RecurringBill.next_due_date <= end,
                )
            )
        )
        .scalars()
        .all()
    )
    for b in bills:
        items.append(
            CalendarItem(
                entity_type="bill",
                entity_id=str(b.id),
                name=bill_display_name(b),
                amount=Decimal(str(b.average_amount)) if b.average_amount else None,
                due_date=b.next_due_date,
            )
        )

    items.sort(key=lambda x: x.due_date)
    return items


# Step in months for each recurrence cadence. 0 == non-recurring (single date).
_BILL_STEP = {
    BillCycle.monthly.value: 1,
    BillCycle.bimonthly.value: 2,
    BillCycle.quarterly.value: 3,
    BillCycle.annual.value: 12,
    BillCycle.yearly.value: 12,
}
_TAX_STEP = {
    RecurrenceRule.MONTHLY.value: 1,
    RecurrenceRule.QUARTERLY.value: 3,
    RecurrenceRule.ANNUAL.value: 12,
}
_PREMIUM_STEP = {
    PremiumFrequency.monthly.value: 1,
    PremiumFrequency.quarterly.value: 3,
    PremiumFrequency.half_yearly.value: 6,
    PremiumFrequency.annual.value: 12,
}


def _occurrences_in_year(base: date, step_months: int, year: int) -> list[date]:
    """Project a recurring due date across a calendar year.

    Steps the cadence back to (or before) Jan 1 and then forward to Dec 31,
    collecting every occurrence that lands inside the year. A step of 0 yields
    the single ``base`` date only when it falls within the year.
    """
    start = date(year, 1, 1)
    end = date(year, 12, 31)
    if step_months <= 0:
        return [base] if start <= base <= end else []

    d = base
    while d > start:
        d -= relativedelta(months=step_months)
    occurrences: list[date] = []
    while d <= end:
        if d >= start:
            occurrences.append(d)
        d += relativedelta(months=step_months)
    return occurrences


def _occurrence_status(occurrence: date, current_due: date, today: date, terminal: bool) -> str:
    if terminal:
        return "paid"
    if occurrence < current_due:
        # Earlier than the entity's current stored due date — the schedule has
        # already advanced past it, so it was paid.
        return "paid"
    if occurrence < today:
        return "overdue"
    return "due"


async def get_calendar_year(
    db: AsyncSession, user_id: uuid.UUID, year: int
) -> list[CalendarYearItem]:
    """Every payable occurrence across a calendar year, with recurring bills /
    taxes / premiums projected onto each month they fall due. Powers the
    dashboard's day-of-month × month grid."""
    today = date.today()
    items: list[CalendarYearItem] = []

    taxes = (
        (await db.execute(select(TaxObligation).where(TaxObligation.user_id == user_id)))
        .scalars()
        .all()
    )
    for t in taxes:
        if t.is_archived or t.due_date is None:
            continue
        terminal = t.status in (ObligationStatus.paid.value, ObligationStatus.exempt.value)
        step = _TAX_STEP.get(t.recurrence_rule, 0) if t.recurrence_rule else 0
        amount = Decimal(str(t.total_amount)) if t.total_amount else None
        name = tax_display_name(t)
        for occ in _occurrences_in_year(t.due_date, step, year):
            items.append(
                CalendarYearItem(
                    entity_type="tax",
                    entity_id=str(t.id),
                    name=name,
                    amount=amount,
                    due_date=occ,
                    status=_occurrence_status(occ, t.due_date, today, terminal),
                )
            )

    policies = (
        (await db.execute(select(InsurancePolicy).where(InsurancePolicy.user_id == user_id)))
        .scalars()
        .all()
    )
    for p in policies:
        if p.next_premium_date is None:
            continue
        terminal = p.status != "active"
        step = _PREMIUM_STEP.get(p.premium_frequency, 12)
        for occ in _occurrences_in_year(p.next_premium_date, step, year):
            items.append(
                CalendarYearItem(
                    entity_type="insurance",
                    entity_id=str(p.id),
                    name=insurance_display_name(p),
                    amount=Decimal(str(p.premium_amount)),
                    due_date=occ,
                    status=_occurrence_status(occ, p.next_premium_date, today, terminal),
                )
            )

    bills = (
        (await db.execute(select(RecurringBill).where(RecurringBill.user_id == user_id)))
        .scalars()
        .all()
    )
    for b in bills:
        if b.next_due_date is None:
            continue
        terminal = not b.is_active
        # Unknown cadence → treat as a single, non-recurring date (step 0) rather
        # than monthly, so a mis-mapped cycle can never spam every month.
        step = _BILL_STEP.get(b.billing_cycle, 0)
        amount = Decimal(str(b.average_amount)) if b.average_amount else None
        name = bill_display_name(b)
        for occ in _occurrences_in_year(b.next_due_date, step, year):
            items.append(
                CalendarYearItem(
                    entity_type="bill",
                    entity_id=str(b.id),
                    name=name,
                    amount=amount,
                    due_date=occ,
                    status=_occurrence_status(occ, b.next_due_date, today, terminal),
                )
            )

    items.sort(key=lambda x: x.due_date)
    return items
