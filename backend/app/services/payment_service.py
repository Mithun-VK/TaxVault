import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction
from app.core.exceptions import NotFoundError
from app.models.payment import Payment
from app.schemas.payment import PaymentListResponse, PaymentOut, PaymentUpdate
from app.services.audit_service import log_audit


async def list_payments(
    db: AsyncSession,
    user_id: uuid.UUID,
    entity_type: str | None,
    from_date: date | None,
    to_date: date | None,
    skip: int,
    limit: int,
) -> PaymentListResponse:
    q = select(Payment).where(Payment.user_id == user_id)
    if entity_type:
        q = q.where(Payment.entity_type == entity_type)
    if from_date:
        q = q.where(Payment.payment_date >= from_date)
    if to_date:
        q = q.where(Payment.payment_date <= to_date)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Payment.payment_date.desc()).offset(skip).limit(limit))
    return PaymentListResponse(
        items=[PaymentOut.model_validate(p) for p in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_payment(db: AsyncSession, user_id: uuid.UUID, payment_id: uuid.UUID) -> PaymentOut:
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.user_id == user_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundError("Payment not found")
    return PaymentOut.model_validate(payment)


async def update_payment(
    db: AsyncSession, user_id: uuid.UUID, payment_id: uuid.UUID, payload: PaymentUpdate
) -> PaymentOut:
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.user_id == user_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundError("Payment not found")

    old_vals: dict = {}
    for k, v in payload.model_dump(exclude_none=True).items():
        old_vals[k] = {"old": getattr(payment, k), "new": v}
        setattr(payment, k, v)

    await log_audit(db, user_id, AuditAction.update, "payment", payment.id, old_vals)
    await db.commit()
    await db.refresh(payment)
    return PaymentOut.model_validate(payment)


async def delete_payment(db: AsyncSession, user_id: uuid.UUID, payment_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.user_id == user_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundError("Payment not found")
    await log_audit(db, user_id, AuditAction.delete, "payment", payment.id)
    await db.delete(payment)
    await db.commit()
