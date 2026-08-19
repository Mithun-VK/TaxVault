import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class PayableReportRow(BaseModel):
    entity_id: uuid.UUID
    entity_name: str
    entity_type: str
    # bill_type / tax_type / insurance_type - lets the client carve out
    # "other payables" and group by kind.
    subtype: str | None = None
    # month number (1-12) -> total amount paid that month
    months: dict[int, Decimal]
    total: Decimal


class PayablesReport(BaseModel):
    year: int
    entity_type: str
    rows: list[PayableReportRow]


class AssetRegisterRow(BaseModel):
    id: uuid.UUID
    name: str
    asset_type: str
    status: str
    acquisition_date: date | None
    acquisition_cost: Decimal | None
    current_value: Decimal | None
    taxes_paid: Decimal
    premiums_paid: Decimal


class AssetRegisterReport(BaseModel):
    rows: list[AssetRegisterRow]
