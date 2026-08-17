import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import CALENDAR_VIEW
from app.schemas.dashboard import (
    CalendarItem,
    CalendarYearItem,
    DashboardSummary,
    RecentActivity,
    UpcomingItem,
)
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/summary", response_model=DashboardSummary, dependencies=[Depends(require(CALENDAR_VIEW))]
)
async def summary(
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await dashboard_service.get_summary(db, vault_id)


@router.get(
    "/upcoming", response_model=list[UpcomingItem], dependencies=[Depends(require(CALENDAR_VIEW))]
)
async def upcoming(
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await dashboard_service.get_upcoming(db, vault_id)


@router.get(
    "/recent-activity",
    response_model=list[RecentActivity],
    dependencies=[Depends(require(CALENDAR_VIEW))],
)
async def recent_activity(
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await dashboard_service.get_recent_activity(db, vault_id)


@router.get(
    "/calendar", response_model=list[CalendarItem], dependencies=[Depends(require(CALENDAR_VIEW))]
)
async def calendar(
    month: str = Query(..., example="2026-06"),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await dashboard_service.get_calendar(db, vault_id, month)


@router.get(
    "/calendar-year",
    response_model=list[CalendarYearItem],
    dependencies=[Depends(require(CALENDAR_VIEW))],
)
async def calendar_year(
    year: int = Query(..., ge=2000, le=2100, example=2026),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await dashboard_service.get_calendar_year(db, vault_id, year)
