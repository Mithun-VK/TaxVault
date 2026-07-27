import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.recurring_bill import BillCreate, BillListResponse, BillOut, BillUpdate
from app.services import bill_service

router = APIRouter(prefix="/bills", tags=["bills"])


class BillPayRequest(BaseModel):
    amount_paid: Decimal = Field(gt=0)
    payment_date: date
    payment_method: str | None = None
    reference_number: str | None = None
    notes: str | None = None
    receipt_document_id: uuid.UUID | None = None


@router.get("/", response_model=BillListResponse)
async def list_bills(
    type: str | None = Query(None, alias="type"),
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await bill_service.list_bills(db, current_user.id, type, is_active, skip, limit)


@router.post("/", response_model=BillOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_bill(
    payload: BillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await bill_service.create_bill(db, current_user.id, payload)


@router.get("/{bill_id}", response_model=BillOut)
async def get_bill(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await bill_service.get_bill(db, current_user.id, bill_id)


@router.patch("/{bill_id}", response_model=BillOut, dependencies=[Depends(require_admin)])
async def update_bill(
    bill_id: uuid.UUID,
    payload: BillUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await bill_service.update_bill(db, current_user.id, bill_id, payload)


@router.delete("/{bill_id}", status_code=200, dependencies=[Depends(require_admin)])
async def deactivate_bill(
    bill_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await bill_service.deactivate_bill(db, current_user.id, bill_id)
    return {"detail": "Bill deactivated successfully"}


@router.post("/{bill_id}/pay", response_model=BillOut)
async def pay_bill(
    bill_id: uuid.UUID,
    payload: BillPayRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await bill_service.pay_bill(
        db,
        current_user.id,
        bill_id,
        payload.amount_paid,
        payload.payment_date,
        payload.payment_method,
        payload.reference_number,
        payload.notes,
        payload.receipt_document_id,
    )
