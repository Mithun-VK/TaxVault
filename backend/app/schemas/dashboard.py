from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_assets_value: Decimal
    due_this_month: int
    overdue_count: int
    total_paid_this_fy: Decimal


class UpcomingItem(BaseModel):
    entity_type: str
    entity_id: str
    name: str
    amount: Decimal | None
    due_date: date
    days_remaining: int


class RecentActivity(BaseModel):
    action: str
    entity_type: str
    entity_id: str
    created_at: str
    user_id: str


class CalendarItem(BaseModel):
    entity_type: str
    entity_id: str
    name: str
    amount: Decimal | None
    due_date: date


class CalendarYearItem(BaseModel):
    entity_type: str
    entity_id: str
    name: str
    amount: Decimal | None
    due_date: date
    # "paid" (occurrence already passed & advanced), "overdue" (past, still due)
    # or "due" (upcoming). Drives the colour of each grid cell.
    status: str
