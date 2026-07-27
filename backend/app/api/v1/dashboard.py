from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import (
    CalendarItem,
    CalendarYearItem,
    DashboardSummary,
    RecentActivity,
    UpcomingItem,
)
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await dashboard_service.get_summary(db, current_user.id)


@router.get("/upcoming", response_model=list[UpcomingItem])
async def upcoming(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await dashboard_service.get_upcoming(db, current_user.id)


@router.get("/recent-activity", response_model=list[RecentActivity])
async def recent_activity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await dashboard_service.get_recent_activity(db, current_user.id)


@router.get("/calendar", response_model=list[CalendarItem])
async def calendar(
    month: str = Query(..., example="2026-06"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await dashboard_service.get_calendar(db, current_user.id, month)


@router.get("/calendar-year", response_model=list[CalendarYearItem])
async def calendar_year(
    year: int = Query(..., ge=2000, le=2100, example=2026),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await dashboard_service.get_calendar_year(db, current_user.id, year)
