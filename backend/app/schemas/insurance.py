import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import InsuranceStatus, InsuranceType, PremiumFrequency


class InsuranceCreate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    asset_id: uuid.UUID | None = None
    individual_id: uuid.UUID | None = None
    policy_number: str = Field(min_length=1, max_length=100)
    provider_name: str = Field(min_length=1, max_length=200)
    # User-extensible category (stored as a plain string).
    insurance_type: str = Field(min_length=1, max_length=50)
    sum_insured: Decimal | None = Field(default=None, ge=0)
    premium_amount: Decimal = Field(ge=0)
    premium_frequency: PremiumFrequency
    next_premium_date: date | None = None
    policy_start_date: date | None = None
    policy_end_date: date | None = None
    maturity_date: date | None = None
    nominee_name: str | None = Field(default=None, max_length=200)
    nominee_relation: str | None = Field(default=None, max_length=100)
    status: InsuranceStatus = InsuranceStatus.active
    notes: str | None = Field(default=None, max_length=2000)


class InsuranceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    asset_id: uuid.UUID | None = None
    individual_id: uuid.UUID | None = None
    policy_number: str | None = Field(default=None, min_length=1, max_length=100)
    provider_name: str | None = Field(default=None, min_length=1, max_length=200)
    insurance_type: str | None = Field(default=None, max_length=50)
    sum_insured: Decimal | None = Field(default=None, ge=0)
    premium_amount: Decimal | None = Field(default=None, ge=0)
    premium_frequency: PremiumFrequency | None = None
    next_premium_date: date | None = None
    policy_start_date: date | None = None
    policy_end_date: date | None = None
    maturity_date: date | None = None
    nominee_name: str | None = Field(default=None, max_length=200)
    nominee_relation: str | None = Field(default=None, max_length=100)
    status: InsuranceStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)


class InsuranceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None
    asset_id: uuid.UUID | None
    individual_id: uuid.UUID | None
    policy_number: str
    provider_name: str
    insurance_type: str
    sum_insured: Decimal | None
    premium_amount: Decimal
    premium_frequency: str
    next_premium_date: date | None
    policy_start_date: date | None
    policy_end_date: date | None
    maturity_date: date | None
    nominee_name: str | None
    nominee_relation: str | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime | None


class InsuranceListResponse(BaseModel):
    items: list[InsuranceOut]
    total: int
    skip: int
    limit: int
