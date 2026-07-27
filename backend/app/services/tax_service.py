import uuid
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType, ObligationStatus, RecurrenceRule
from app.core.exceptions import NotFoundError
from app.models.alert_config import AlertConfig
from app.models.asset import Asset
from app.models.payment import Payment
from app.models.tax_obligation import TaxObligation
from app.schemas.tax_obligation import TaxCreate, TaxListResponse, TaxOut, TaxUpdate
from app.services.audit_service import log_audit


def _advance_due_date(due_date: date, rule: str) -> date:
    if rule == RecurrenceRule.MONTHLY.value:
        return due_date + relativedelta(months=1)
    elif rule == RecurrenceRule.QUARTERLY.value:
        return due_date + relativedelta(months=3)
    else:  # ANNUAL
        return due_date + relativedelta(years=1)


async def list_taxes(
    db: AsyncSession,
    user_id: uuid.UUID,
    tax_type: str | None,
    status: str | None,
    skip: int,
    limit: int,
) -> TaxListResponse:
    q = select(TaxObligation).where(
        TaxObligation.user_id == user_id, TaxObligation.is_archived == False
    )
    if tax_type:
        q = q.where(TaxObligation.tax_type == tax_type)
    if status:
        q = q.where(TaxObligation.status == status)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(skip).limit(limit))
    return TaxListResponse(
        items=[TaxOut.model_validate(t) for t in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


async def create_tax(db: AsyncSession, user_id: uuid.UUID, payload: TaxCreate) -> TaxOut:
    if payload.asset_id is not None:
        asset = (
            await db.execute(
                select(Asset).where(Asset.id == payload.asset_id, Asset.user_id == user_id)
            )
        ).scalar_one_or_none()
        if not asset:
            raise NotFoundError("Asset not found")

    tax = TaxObligation(user_id=user_id, **payload.model_dump())
    db.add(tax)
    await db.flush()

    alert = AlertConfig(
        user_id=user_id,
        entity_type=EntityType.tax.value,
        entity_id=tax.id,
    )
    db.add(alert)

    await log_audit(db, user_id, AuditAction.create, "tax", tax.id, payload.model_dump())
    await db.commit()
    await db.refresh(tax)
    return TaxOut.model_validate(tax)


async def get_tax(db: AsyncSession, user_id: uuid.UUID, tax_id: uuid.UUID) -> TaxOut:
    result = await db.execute(
        select(TaxObligation).where(
            TaxObligation.id == tax_id,
            TaxObligation.user_id == user_id,
            TaxObligation.is_archived == False,
        )
    )
    tax = result.scalar_one_or_none()
    if not tax:
        raise NotFoundError("Tax obligation not found")
    return TaxOut.model_validate(tax)


async def update_tax(
    db: AsyncSession, user_id: uuid.UUID, tax_id: uuid.UUID, payload: TaxUpdate
) -> TaxOut:
    result = await db.execute(
        select(TaxObligation).where(
            TaxObligation.id == tax_id,
            TaxObligation.user_id == user_id,
            TaxObligation.is_archived == False,
        )
    )
    tax = result.scalar_one_or_none()
    if not tax:
        raise NotFoundError("Tax obligation not found")

    old_vals: dict = {}
    for k, v in payload.model_dump(exclude_none=True).items():
        old_vals[k] = {"old": getattr(tax, k), "new": v}
        setattr(tax, k, v)

    # The property link and the individual link are mutually exclusive and are
    # sent together by the form. Apply both explicitly (even when null) so
    # switching the tax type also clears the previous link — the exclude_none
    # loop above would otherwise skip the null and leave a stale reference.
    if payload.tax_type is not None:
        tax.asset_id = payload.asset_id
        tax.individual_id = payload.individual_id

    await log_audit(db, user_id, AuditAction.update, "tax", tax.id, old_vals)
    await db.commit()
    await db.refresh(tax)
    return TaxOut.model_validate(tax)


async def archive_tax(db: AsyncSession, user_id: uuid.UUID, tax_id: uuid.UUID) -> None:
    result = await db.execute(
        select(TaxObligation).where(TaxObligation.id == tax_id, TaxObligation.user_id == user_id)
    )
    tax = result.scalar_one_or_none()
    if not tax:
        raise NotFoundError("Tax obligation not found")
    tax.is_archived = True
    await log_audit(db, user_id, AuditAction.delete, "tax", tax.id)
    await db.commit()


async def pay_tax(
    db: AsyncSession,
    user_id: uuid.UUID,
    tax_id: uuid.UUID,
    amount_paid: Decimal,
    payment_date: date,
    payment_method: str | None,
    reference_number: str | None,
    notes: str | None,
    receipt_document_id: uuid.UUID | None = None,
) -> TaxOut:
    result = await db.execute(
        select(TaxObligation).where(TaxObligation.id == tax_id, TaxObligation.user_id == user_id)
    )
    tax = result.scalar_one_or_none()
    if not tax:
        raise NotFoundError("Tax obligation not found")

    payment = Payment(
        user_id=user_id,
        entity_type=EntityType.tax.value,
        entity_id=tax_id,
        amount_paid=amount_paid,
        payment_date=payment_date,
        payment_method=payment_method,
        reference_number=reference_number,
        notes=notes,
        receipt_document_id=receipt_document_id,
    )
    db.add(payment)
    await db.flush()

    paid_q = select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
        Payment.entity_type == EntityType.tax.value,
        Payment.entity_id == tax_id,
    )
    total_paid = Decimal(str((await db.execute(paid_q)).scalar_one()))

    if tax.total_amount and total_paid >= Decimal(str(tax.total_amount)):
        if tax.recurrence_rule:
            tax.due_date = _advance_due_date(tax.due_date, tax.recurrence_rule)
            tax.status = ObligationStatus.pending.value
        else:
            tax.status = ObligationStatus.paid.value

    await log_audit(db, user_id, AuditAction.create, "payment", payment.id)
    await db.commit()
    await db.refresh(tax)
    return TaxOut.model_validate(tax)
