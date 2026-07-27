import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.insurance import (
    InsuranceCreate,
    InsuranceListResponse,
    InsuranceOut,
    InsuranceUpdate,
)
from app.services import insurance_service

router = APIRouter(prefix="/insurance", tags=["insurance"])


class PremiumPayRequest(BaseModel):
    amount_paid: Decimal = Field(gt=0)
    payment_date: date
    payment_method: str | None = None
    reference_number: str | None = None
    period: str | None = None
    notes: str | None = None
    receipt_document_id: uuid.UUID | None = None


@router.get("/", response_model=InsuranceListResponse)
async def list_insurance(
    type: str | None = Query(None, alias="type"),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await insurance_service.list_insurance(db, current_user.id, type, status, skip, limit)


@router.post("/", response_model=InsuranceOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_insurance(
    payload: InsuranceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await insurance_service.create_insurance(db, current_user.id, payload)


@router.get("/{policy_id}", response_model=InsuranceOut)
async def get_insurance(
    policy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await insurance_service.get_insurance(db, current_user.id, policy_id)


@router.patch("/{policy_id}", response_model=InsuranceOut, dependencies=[Depends(require_admin)])
async def update_insurance(
    policy_id: uuid.UUID,
    payload: InsuranceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await insurance_service.update_insurance(db, current_user.id, policy_id, payload)


@router.delete("/{policy_id}", status_code=200, dependencies=[Depends(require_admin)])
async def archive_insurance(
    policy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await insurance_service.archive_insurance(db, current_user.id, policy_id)
    return {"detail": "Insurance policy archived successfully"}


@router.post("/{policy_id}/pay-premium", response_model=InsuranceOut)
async def pay_premium(
    policy_id: uuid.UUID,
    payload: PremiumPayRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await insurance_service.pay_premium(
        db,
        current_user.id,
        policy_id,
        payload.amount_paid,
        payload.payment_date,
        payload.payment_method,
        payload.reference_number,
        payload.notes,
        payload.receipt_document_id,
        payload.period,
    )
