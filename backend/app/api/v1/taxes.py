import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import (
    PAYMENTS_CREATE,
    TAXES_CREATE,
    TAXES_DELETE,
    TAXES_EDIT,
    TAXES_VIEW,
)
from app.schemas.tax_obligation import TaxCreate, TaxListResponse, TaxOut, TaxUpdate
from app.services import tax_service

router = APIRouter(prefix="/taxes", tags=["taxes"])


class TaxPayRequest(BaseModel):
    amount_paid: Decimal = Field(gt=0)
    payment_date: date
    payment_method: str | None = None
    reference_number: str | None = None
    period: str | None = None
    notes: str | None = None
    receipt_document_id: uuid.UUID | None = None


@router.get("/", response_model=TaxListResponse, dependencies=[Depends(require(TAXES_VIEW))])
async def list_taxes(
    type: str | None = Query(None, alias="type"),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await tax_service.list_taxes(db, vault_id, type, status, skip, limit)


@router.post(
    "/", response_model=TaxOut, status_code=201, dependencies=[Depends(require(TAXES_CREATE))]
)
async def create_tax(
    payload: TaxCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await tax_service.create_tax(db, vault_id, payload)


@router.get("/{tax_id}", response_model=TaxOut, dependencies=[Depends(require(TAXES_VIEW))])
async def get_tax(
    tax_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await tax_service.get_tax(db, vault_id, tax_id)


@router.patch("/{tax_id}", response_model=TaxOut, dependencies=[Depends(require(TAXES_EDIT))])
async def update_tax(
    tax_id: uuid.UUID,
    payload: TaxUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await tax_service.update_tax(db, vault_id, tax_id, payload)


@router.delete("/{tax_id}", status_code=200, dependencies=[Depends(require(TAXES_DELETE))])
async def archive_tax(
    tax_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    await tax_service.archive_tax(db, vault_id, tax_id)
    return {"detail": "Tax obligation archived successfully"}


@router.post(
    "/{tax_id}/pay", response_model=TaxOut, dependencies=[Depends(require(PAYMENTS_CREATE))]
)
async def pay_tax(
    tax_id: uuid.UUID,
    payload: TaxPayRequest,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await tax_service.pay_tax(
        db,
        vault_id,
        tax_id,
        payload.amount_paid,
        payload.payment_date,
        payload.payment_method,
        payload.reference_number,
        payload.notes,
        payload.receipt_document_id,
        payload.period,
    )
