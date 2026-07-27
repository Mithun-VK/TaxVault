import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ObligationStatus, RecurrenceRule, TaxType


class TaxCreate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    asset_id: uuid.UUID | None = None
    individual_id: uuid.UUID | None = None
    # User-extensible category (stored as a plain string), like recurring bills.
    tax_type: str = Field(min_length=1, max_length=50)
    tax_number: str | None = Field(default=None, max_length=100)
    jurisdiction: str | None = Field(default=None, max_length=200)
    assessment_year: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=2000)
    total_amount: Decimal | None = Field(default=None, ge=0)
    due_date: date
    recurrence_rule: RecurrenceRule | None = None
    status: ObligationStatus = ObligationStatus.pending
    notes: str | None = Field(default=None, max_length=2000)


class TaxUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    asset_id: uuid.UUID | None = None
    individual_id: uuid.UUID | None = None
    tax_type: str | None = Field(default=None, max_length=50)
    tax_number: str | None = Field(default=None, max_length=100)
    jurisdiction: str | None = Field(default=None, max_length=200)
    assessment_year: str | None = Field(default=None, max_length=20)
    description: str | None = Field(default=None, max_length=2000)
    total_amount: Decimal | None = Field(default=None, ge=0)
    due_date: date | None = None
    recurrence_rule: RecurrenceRule | None = None
    status: ObligationStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)


class TaxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None
    asset_id: uuid.UUID | None
    individual_id: uuid.UUID | None = None
    tax_type: str
    tax_number: str | None
    jurisdiction: str | None
    assessment_year: str | None
    description: str | None
    total_amount: Decimal | None
    due_date: date
    recurrence_rule: str | None
    status: str
    notes: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime | None


class TaxListResponse(BaseModel):
    items: list[TaxOut]
    total: int
    skip: int
    limit: int
