import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import PAYMENTS_DELETE, PAYMENTS_EDIT, PAYMENTS_VIEW
from app.schemas.payment import PaymentListResponse, PaymentOut, PaymentUpdate
from app.services import payment_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/", response_model=PaymentListResponse, dependencies=[Depends(require(PAYMENTS_VIEW))])
async def list_payments(
    entity_type: str | None = Query(None),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await payment_service.list_payments(
        db, vault_id, entity_type, from_date, to_date, skip, limit
    )


@router.get(
    "/{payment_id}", response_model=PaymentOut, dependencies=[Depends(require(PAYMENTS_VIEW))]
)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await payment_service.get_payment(db, vault_id, payment_id)


@router.patch(
    "/{payment_id}", response_model=PaymentOut, dependencies=[Depends(require(PAYMENTS_EDIT))]
)
async def update_payment(
    payment_id: uuid.UUID,
    payload: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await payment_service.update_payment(db, vault_id, payment_id, payload)


@router.delete("/{payment_id}", status_code=200, dependencies=[Depends(require(PAYMENTS_DELETE))])
async def delete_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    await payment_service.delete_payment(db, vault_id, payment_id)
    return {"detail": "Payment deleted successfully"}
