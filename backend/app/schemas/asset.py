import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import AssetStatus, AssetType


class PropertyDetailsMixin(BaseModel):
    """Canonical Property Details (land & building) — first-class columns."""

    owner_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=2000)
    deed_number: str | None = Field(default=None, max_length=500)
    deed_date: str | None = Field(default=None, max_length=200)
    registration_office: str | None = Field(default=None, max_length=500)
    survey_number: str | None = Field(default=None, max_length=500)
    land_area: str | None = Field(default=None, max_length=200)
    patta_number: str | None = Field(default=None, max_length=500)
    chitta: str | None = Field(default=None, max_length=500)
    adangal: str | None = Field(default=None, max_length=500)
    eb_numbers: str | None = Field(default=None, max_length=500)


class AssetCreate(PropertyDetailsMixin):
    model_config = ConfigDict(populate_by_name=True)

    asset_type: AssetType
    name: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = Field(default=None, ge=0)
    current_value: Decimal | None = Field(default=None, ge=0)
    status: AssetStatus = AssetStatus.active
    individual_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    asset_metadata: dict = Field(default={}, alias="metadata")
    notes: str | None = Field(default=None, max_length=2000)


class AssetUpdate(PropertyDetailsMixin):
    model_config = ConfigDict(populate_by_name=True)

    asset_type: AssetType | None = None
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = Field(default=None, ge=0)
    current_value: Decimal | None = Field(default=None, ge=0)
    status: AssetStatus | None = None
    individual_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    asset_metadata: dict | None = Field(default=None, alias="metadata")
    notes: str | None = Field(default=None, max_length=2000)


class AssetOut(PropertyDetailsMixin):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    user_id: uuid.UUID
    individual_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    asset_type: str
    name: str
    description: str | None
    acquisition_date: date | None
    acquisition_cost: Decimal | None
    current_value: Decimal | None
    status: str
    asset_metadata: dict = Field(serialization_alias="metadata")
    notes: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime | None


class AssetSummary(BaseModel):
    total_taxes_paid: Decimal
    total_taxes_pending: Decimal
    docs_count: int


class AssetListResponse(BaseModel):
    items: list[AssetOut]
    total: int
    skip: int
    limit: int
