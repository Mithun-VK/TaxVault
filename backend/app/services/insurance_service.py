import uuid
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, EntityType
from app.core.exceptions import NotFoundError
from app.models.alert_config import AlertConfig
from app.models.insurance import InsurancePolicy
from app.models.payment import Payment
from app.schemas.insurance import (
    InsuranceCreate,
    InsuranceListResponse,
    InsuranceOut,
    InsuranceUpdate,
)
from app.services.audit_service import log_audit


def _advance_premium_date(current: date | None, frequency: str) -> date:
    base = current or date.today()
    if frequency == "monthly":
        return base + relativedelta(months=1)
    elif frequency == "quarterly":
        return base + relativedelta(months=3)
    elif frequency == "half_yearly":
        return base + relativedelta(months=6)
    else:  # annual
        return base + relativedelta(years=1)


async def list_insurance(
    db: AsyncSession,
    user_id: uuid.UUID,
    insurance_type: str | None,
    status: str | None,
    skip: int,
    limit: int,
) -> InsuranceListResponse:
    q = select(InsurancePolicy).where(InsurancePolicy.user_id == user_id)
    if insurance_type:
        q = q.where(InsurancePolicy.insurance_type == insurance_type)
    if status:
        q = q.where(InsurancePolicy.status == status)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(skip).limit(limit))
    return InsuranceListResponse(
        items=[InsuranceOut.model_validate(p) for p in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


async def create_insurance(
    db: AsyncSession, user_id: uuid.UUID, payload: InsuranceCreate
) -> InsuranceOut:
    policy = InsurancePolicy(user_id=user_id, **payload.model_dump())
    db.add(policy)
    await db.flush()

    alert = AlertConfig(
        user_id=user_id,
        entity_type=EntityType.insurance.value,
        entity_id=policy.id,
    )
    db.add(alert)

    await log_audit(db, user_id, AuditAction.create, "insurance", policy.id, payload.model_dump())
    await db.commit()
    await db.refresh(policy)
    return InsuranceOut.model_validate(policy)


async def get_insurance(db: AsyncSession, user_id: uuid.UUID, policy_id: uuid.UUID) -> InsuranceOut:
    result = await db.execute(
        select(InsurancePolicy).where(
            InsurancePolicy.id == policy_id,
            InsurancePolicy.user_id == user_id,
            InsurancePolicy.status != "surrendered",
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise NotFoundError("Insurance policy not found")
    return InsuranceOut.model_validate(policy)


async def update_insurance(
    db: AsyncSession, user_id: uuid.UUID, policy_id: uuid.UUID, payload: InsuranceUpdate
) -> InsuranceOut:
    result = await db.execute(
        select(InsurancePolicy).where(
            InsurancePolicy.id == policy_id, InsurancePolicy.user_id == user_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise NotFoundError("Insurance policy not found")

    old_vals: dict = {}
    updates = payload.model_dump(exclude_none=True)
    freq_changed = "premium_frequency" in updates
    for k, v in updates.items():
        old_vals[k] = {"old": getattr(policy, k), "new": v}
        setattr(policy, k, v)

    # The asset link and the individual link are mutually exclusive and are sent
    # together by the form. Apply both explicitly (even when null) so switching a
    # policy's type also clears the previous link - the exclude_none loop above
    # would otherwise skip the null and leave a stale reference.
    if payload.insurance_type is not None:
        policy.asset_id = payload.asset_id
        policy.individual_id = payload.individual_id

    if freq_changed and policy.next_premium_date:
        policy.next_premium_date = _advance_premium_date(
            policy.next_premium_date, policy.premium_frequency
        )

    await log_audit(db, user_id, AuditAction.update, "insurance", policy.id, old_vals)
    await db.commit()
    await db.refresh(policy)
    return InsuranceOut.model_validate(policy)


async def archive_insurance(db: AsyncSession, user_id: uuid.UUID, policy_id: uuid.UUID) -> None:
    result = await db.execute(
        select(InsurancePolicy).where(
            InsurancePolicy.id == policy_id, InsurancePolicy.user_id == user_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise NotFoundError("Insurance policy not found")
    policy.status = "surrendered"
    await log_audit(db, user_id, AuditAction.delete, "insurance", policy.id)
    await db.commit()


async def pay_premium(
    db: AsyncSession,
    user_id: uuid.UUID,
    policy_id: uuid.UUID,
    amount_paid: Decimal,
    payment_date: date,
    payment_method: str | None,
    reference_number: str | None,
    notes: str | None,
    receipt_document_id: uuid.UUID | None = None,
    period: str | None = None,
) -> InsuranceOut:
    result = await db.execute(
        select(InsurancePolicy).where(
            InsurancePolicy.id == policy_id, InsurancePolicy.user_id == user_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise NotFoundError("Insurance policy not found")

    payment = Payment(
        user_id=user_id,
        entity_type=EntityType.insurance.value,
        entity_id=policy_id,
        amount_paid=amount_paid,
        payment_date=payment_date,
        payment_method=payment_method,
        reference_number=reference_number,
        notes=notes,
        period=period,
        receipt_document_id=receipt_document_id,
    )
    db.add(payment)

    policy.next_premium_date = _advance_premium_date(
        policy.next_premium_date, policy.premium_frequency
    )

    await log_audit(
        db, user_id, AuditAction.create, "payment", payment.id if payment.id else uuid.uuid4()
    )
    await db.commit()
    await db.refresh(policy)
    return InsuranceOut.model_validate(policy)
