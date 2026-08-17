import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import EntityType
from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import REPORTS_VIEW
from app.schemas.report import AssetRegisterReport, PayablesReport
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get(
    "/payables", response_model=PayablesReport, dependencies=[Depends(require(REPORTS_VIEW))]
)
async def payables(
    type: EntityType = Query(..., description="bill, tax or insurance"),
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await report_service.payables_report(db, vault_id, type.value, year)


@router.get(
    "/assets", response_model=AssetRegisterReport, dependencies=[Depends(require(REPORTS_VIEW))]
)
async def assets(
    vehicle_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await report_service.asset_register(db, vault_id, vehicle_only)
