import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import (
    INSURANCE_CREATE,
    INSURANCE_DELETE,
    INSURANCE_EDIT,
    INSURANCE_VIEW,
    PAYMENTS_CREATE,
)
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


@router.get(
    "/", response_model=InsuranceListResponse, dependencies=[Depends(require(INSURANCE_VIEW))]
)
async def list_insurance(
    type: str | None = Query(None, alias="type"),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await insurance_service.list_insurance(db, vault_id, type, status, skip, limit)


@router.post(
    "/",
    response_model=InsuranceOut,
    status_code=201,
    dependencies=[Depends(require(INSURANCE_CREATE))],
)
async def create_insurance(
    payload: InsuranceCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await insurance_service.create_insurance(db, vault_id, payload)


@router.get(
    "/{policy_id}", response_model=InsuranceOut, dependencies=[Depends(require(INSURANCE_VIEW))]
)
async def get_insurance(
    policy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await insurance_service.get_insurance(db, vault_id, policy_id)


@router.patch(
    "/{policy_id}", response_model=InsuranceOut, dependencies=[Depends(require(INSURANCE_EDIT))]
)
async def update_insurance(
    policy_id: uuid.UUID,
    payload: InsuranceUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await insurance_service.update_insurance(db, vault_id, policy_id, payload)


@router.delete("/{policy_id}", status_code=200, dependencies=[Depends(require(INSURANCE_DELETE))])
async def archive_insurance(
    policy_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    await insurance_service.archive_insurance(db, vault_id, policy_id)
    return {"detail": "Insurance policy archived successfully"}


@router.post(
    "/{policy_id}/pay-premium",
    response_model=InsuranceOut,
    dependencies=[Depends(require(PAYMENTS_CREATE))],
)
async def pay_premium(
    policy_id: uuid.UUID,
    payload: PremiumPayRequest,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await insurance_service.pay_premium(
        db,
        vault_id,
        policy_id,
        payload.amount_paid,
        payload.payment_date,
        payload.payment_method,
        payload.reference_number,
        payload.notes,
        payload.receipt_document_id,
        payload.period,
    )
