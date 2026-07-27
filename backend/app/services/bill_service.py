import uuid
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, BillCycle, EntityType
from app.core.exceptions import NotFoundError
from app.models.alert_config import AlertConfig
from app.models.payment import Payment
from app.models.recurring_bill import RecurringBill
from app.schemas.recurring_bill import BillCreate, BillListResponse, BillOut, BillUpdate
from app.services.audit_service import log_audit


def _advance_due_date(due_date: date, cycle: str) -> date:
    if cycle == BillCycle.monthly.value:
        return due_date + relativedelta(months=1)
    elif cycle == BillCycle.bimonthly.value:
        return due_date + relativedelta(months=2)
    else:  # quarterly
        return due_date + relativedelta(months=3)


async def list_bills(
    db: AsyncSession,
    user_id: uuid.UUID,
    bill_type: str | None,
    is_active: bool | None,
    skip: int,
    limit: int,
) -> BillListResponse:
    q = select(RecurringBill).where(RecurringBill.user_id == user_id)
    if bill_type:
        q = q.where(RecurringBill.bill_type == bill_type)
    if is_active is not None:
        q = q.where(RecurringBill.is_active == is_active)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(skip).limit(limit))
    return BillListResponse(
        items=[BillOut.model_validate(b) for b in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


async def create_bill(db: AsyncSession, user_id: uuid.UUID, payload: BillCreate) -> BillOut:
    bill = RecurringBill(user_id=user_id, **payload.model_dump())
    db.add(bill)
    await db.flush()

    alert = AlertConfig(
        user_id=user_id,
        entity_type=EntityType.bill.value,
        entity_id=bill.id,
    )
    db.add(alert)

    await log_audit(db, user_id, AuditAction.create, "bill", bill.id, payload.model_dump())
    await db.commit()
    await db.refresh(bill)
    return BillOut.model_validate(bill)


async def get_bill(db: AsyncSession, user_id: uuid.UUID, bill_id: uuid.UUID) -> BillOut:
    result = await db.execute(
        select(RecurringBill).where(RecurringBill.id == bill_id, RecurringBill.user_id == user_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise NotFoundError("Bill not found")
    return BillOut.model_validate(bill)


async def update_bill(
    db: AsyncSession, user_id: uuid.UUID, bill_id: uuid.UUID, payload: BillUpdate
) -> BillOut:
    result = await db.execute(
        select(RecurringBill).where(RecurringBill.id == bill_id, RecurringBill.user_id == user_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise NotFoundError("Bill not found")

    old_vals: dict = {}
    for k, v in payload.model_dump(exclude_none=True).items():
        old_vals[k] = {"old": getattr(bill, k), "new": v}
        setattr(bill, k, v)

    await log_audit(db, user_id, AuditAction.update, "bill", bill.id, old_vals)
    await db.commit()
    await db.refresh(bill)
    return BillOut.model_validate(bill)


async def deactivate_bill(db: AsyncSession, user_id: uuid.UUID, bill_id: uuid.UUID) -> None:
    result = await db.execute(
        select(RecurringBill).where(RecurringBill.id == bill_id, RecurringBill.user_id == user_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise NotFoundError("Bill not found")
    bill.is_active = False
    await log_audit(db, user_id, AuditAction.delete, "bill", bill.id)
    await db.commit()


async def pay_bill(
    db: AsyncSession,
    user_id: uuid.UUID,
    bill_id: uuid.UUID,
    amount_paid: Decimal,
    payment_date: date,
    payment_method: str | None,
    reference_number: str | None,
    notes: str | None,
    receipt_document_id: uuid.UUID | None = None,
    period: str | None = None,
) -> BillOut:
    result = await db.execute(
        select(RecurringBill).where(RecurringBill.id == bill_id, RecurringBill.user_id == user_id)
    )
    bill = result.scalar_one_or_none()
    if not bill:
        raise NotFoundError("Bill not found")

    payment = Payment(
        user_id=user_id,
        entity_type=EntityType.bill.value,
        entity_id=bill_id,
        amount_paid=amount_paid,
        payment_date=payment_date,
        payment_method=payment_method,
        reference_number=reference_number,
        notes=notes,
        period=period,
        receipt_document_id=receipt_document_id,
    )
    db.add(payment)

    bill.next_due_date = _advance_due_date(bill.next_due_date, bill.billing_cycle)

    await log_audit(
        db, user_id, AuditAction.create, "payment", payment.id if payment.id else uuid.uuid4()
    )
    await db.commit()
    await db.refresh(bill)
    return BillOut.model_validate(bill)
