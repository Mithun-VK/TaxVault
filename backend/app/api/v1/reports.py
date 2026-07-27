from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import EntityType
from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.report import AssetRegisterReport, PayablesReport
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/payables", response_model=PayablesReport)
async def payables(
    type: EntityType = Query(..., description="bill, tax or insurance"),
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await report_service.payables_report(db, current_user.id, type.value, year)


@router.get("/assets", response_model=AssetRegisterReport)
async def assets(
    vehicle_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await report_service.asset_register(db, current_user.id, vehicle_only)
