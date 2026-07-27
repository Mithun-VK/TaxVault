import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import BillCycle

# Bill categories are user-extensible: the built-ins live in BillType, but any
# lowercase slug is accepted so users can add their own category from the UI.
BillTypeField = Field(pattern=r"^[a-z0-9_]{1,40}$")


class BillCreate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    bill_type: str = BillTypeField
    provider_name: str | None = Field(default=None, max_length=200)
    account_number: str | None = Field(default=None, max_length=100)
    billing_cycle: BillCycle
    average_amount: Decimal | None = Field(default=None, ge=0)
    next_due_date: date
    is_active: bool = True
    notes: str | None = Field(default=None, max_length=2000)


class BillUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    bill_type: str | None = Field(default=None, pattern=r"^[a-z0-9_]{1,40}$")
    provider_name: str | None = Field(default=None, max_length=200)
    account_number: str | None = Field(default=None, max_length=100)
    billing_cycle: BillCycle | None = None
    average_amount: Decimal | None = Field(default=None, ge=0)
    next_due_date: date | None = None
    is_active: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)


class BillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None
    bill_type: str
    provider_name: str | None
    account_number: str | None
    billing_cycle: str
    average_amount: Decimal | None
    next_due_date: date
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime | None


class BillListResponse(BaseModel):
    items: list[BillOut]
    total: int
    skip: int
    limit: int
