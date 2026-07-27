import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.payment import PaymentListResponse, PaymentOut, PaymentUpdate
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=PaymentListResponse)
async def list_payments(
    entity_type: str | None = Query(None),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await payment_service.list_payments(
        db, current_user.id, entity_type, from_date, to_date, skip, limit
    )


@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await payment_service.get_payment(db, current_user.id, payment_id)


@router.patch("/{payment_id}", response_model=PaymentOut, dependencies=[Depends(require_admin)])
async def update_payment(
    payment_id: uuid.UUID,
    payload: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await payment_service.update_payment(db, current_user.id, payment_id, payload)


@router.delete("/{payment_id}", status_code=200, dependencies=[Depends(require_admin)])
async def delete_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await payment_service.delete_payment(db, current_user.id, payment_id)
    return {"detail": "Payment deleted successfully"}
