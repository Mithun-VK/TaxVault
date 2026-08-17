import re
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models.company import COMPANY_STATUSES, COMPANY_TYPES
from app.models.company_document import COMPANY_DOCUMENT_CATEGORIES

# ── Format rules for the Indian statutory identifiers ────────────────────────
# Kept as module constants so the validators on Create and Update stay in step.
CIN_RE = re.compile(r"^[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$")  # U12345MH2020PTC123456
LLPIN_RE = re.compile(r"^[A-Z]{3}-?\d{4}$")  # AAB-1234
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")  # AABCC1234D
TAN_RE = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]$")  # CHEN12345A
GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")  # 33AABCC1234D1Z5
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")  # ABCD0123456
DIN_RE = re.compile(r"^\d{8}$")
FY_END_RE = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")  # MM-DD


def _upper_or_none(value: str | None) -> str | None:
    """Trim and upper-case an identifier, treating blank as absent.

    The forms submit "" for an untouched field; storing that would defeat the
    partial unique indexes on cin/gstin, which only exclude NULL.
    """
    if value is None:
        return None
    trimmed = value.strip().upper()
    return trimmed or None


def _checked(pattern: re.Pattern[str], value: str | None, message: str) -> str | None:
    value = _upper_or_none(value)
    if value and not pattern.match(value):
        raise ValueError(message)
    return value


# ── Nested JSONB shapes ──────────────────────────────────────────────────────


class BankAccount(BaseModel):
    bank_name: str
    branch: str | None = None
    account_number: str
    ifsc_code: str
    account_type: str = "current"  # current | savings | cc | od
    is_primary: bool = False

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str | None) -> str | None:
        return _checked(IFSC_RE, v, "IFSC code must be in format ABCD0123456")


class Director(BaseModel):
    """A director, partner or trustee.

    ``individual_id`` optionally points at an Individual profile, so a person
    who is both a family member and a director is one record seen twice.
    """

    individual_id: uuid.UUID | None = None
    name: str
    din: str | None = None  # Director Identification Number
    designation: str = "Director"
    appointed_date: date | None = None
    is_active: bool = True

    @field_validator("din")
    @classmethod
    def validate_din(cls, v: str | None) -> str | None:
        v = (v or "").strip() or None
        if v and not DIN_RE.match(v):
            raise ValueError("DIN must be 8 digits")
        return v


class OtherRegistration(BaseModel):
    name: str  # e.g. "FSSAI License"
    number: str = ""  # blank while the number is still being tracked down
    issuing_authority: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    notes: str | None = None


# ── Create / update ──────────────────────────────────────────────────────────


class CompanyBase(BaseModel):
    """Fields common to create and update, with the identifier validators.

    Update re-declares every field as optional; the validators are inherited so
    a PATCH is held to the same formats as a POST.
    """

    @field_validator("cin", check_fields=False)
    @classmethod
    def validate_cin(cls, v: str | None) -> str | None:
        return _checked(CIN_RE, v, "CIN must be in format U12345MH2020PTC123456")

    @field_validator("llpin", check_fields=False)
    @classmethod
    def validate_llpin(cls, v: str | None) -> str | None:
        return _checked(LLPIN_RE, v, "LLPIN must be in format AAB-1234")

    @field_validator("pan_number", check_fields=False)
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        return _checked(PAN_RE, v, "PAN must be in format AABCC1234D")

    @field_validator("tan_number", check_fields=False)
    @classmethod
    def validate_tan(cls, v: str | None) -> str | None:
        return _checked(TAN_RE, v, "TAN must be in format CHEN12345A")

    @field_validator("gstin", check_fields=False)
    @classmethod
    def validate_gstin(cls, v: str | None) -> str | None:
        return _checked(GSTIN_RE, v, "GSTIN must be in format 33AABCC1234D1Z5")

    @field_validator("company_type", check_fields=False)
    @classmethod
    def validate_company_type(cls, v: str | None) -> str | None:
        if v is not None and v not in COMPANY_TYPES:
            raise ValueError(f"company_type must be one of: {', '.join(COMPANY_TYPES)}")
        return v

    @field_validator("status", check_fields=False)
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in COMPANY_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(COMPANY_STATUSES)}")
        return v

    @field_validator("financial_year_end", check_fields=False)
    @classmethod
    def validate_fy_end(cls, v: str | None) -> str | None:
        v = (v or "").strip() or None
        if v and not FY_END_RE.match(v):
            raise ValueError("Financial year end must be in MM-DD format, e.g. 03-31")
        return v


class CompanyCreate(CompanyBase):
    legal_name: str
    trade_name: str | None = None
    company_type: str = "private_limited"
    status: str = "active"
    industry: str | None = None
    description: str | None = None
    incorporation_date: date | None = None
    incorporation_state: str | None = None
    cin: str | None = None
    llpin: str | None = None
    pan_number: str | None = None
    tan_number: str | None = None
    gstin: str | None = None
    income_tax_ward: str | None = None
    foreign_registration_number: str | None = None
    foreign_jurisdiction: str | None = None
    foreign_registration_date: date | None = None
    foreign_registration_expiry: date | None = None
    other_registrations: list[OtherRegistration] = []
    registered_address: str | None = None
    operational_address: str | None = None
    phone_number: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    bank_accounts: list[BankAccount] = []
    directors: list[Director] = []
    authorized_capital: Decimal | None = None
    paid_up_capital: Decimal | None = None
    auditor_name: str | None = None
    auditor_firm_number: str | None = None
    financial_year_end: str | None = "03-31"
    notes: str | None = None


class CompanyUpdate(CompanyBase):
    legal_name: str | None = None
    trade_name: str | None = None
    company_type: str | None = None
    status: str | None = None
    industry: str | None = None
    description: str | None = None
    incorporation_date: date | None = None
    incorporation_state: str | None = None
    cin: str | None = None
    llpin: str | None = None
    pan_number: str | None = None
    tan_number: str | None = None
    gstin: str | None = None
    income_tax_ward: str | None = None
    foreign_registration_number: str | None = None
    foreign_jurisdiction: str | None = None
    foreign_registration_date: date | None = None
    foreign_registration_expiry: date | None = None
    other_registrations: list[OtherRegistration] | None = None
    registered_address: str | None = None
    operational_address: str | None = None
    phone_number: str | None = None
    email: EmailStr | None = None
    website: str | None = None
    bank_accounts: list[BankAccount] | None = None
    directors: list[Director] | None = None
    authorized_capital: Decimal | None = None
    paid_up_capital: Decimal | None = None
    auditor_name: str | None = None
    auditor_firm_number: str | None = None
    financial_year_end: str | None = None
    logo_key: str | None = None
    notes: str | None = None


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    legal_name: str
    trade_name: str | None = None
    company_type: str
    status: str
    industry: str | None = None
    description: str | None = None
    incorporation_date: date | None = None
    incorporation_state: str | None = None
    cin: str | None = None
    llpin: str | None = None
    pan_number: str | None = None
    tan_number: str | None = None
    gstin: str | None = None
    gstin_state_code: str | None = None
    income_tax_ward: str | None = None
    foreign_registration_number: str | None = None
    foreign_jurisdiction: str | None = None
    foreign_registration_date: date | None = None
    foreign_registration_expiry: date | None = None
    other_registrations: list[dict] = []
    registered_address: str | None = None
    operational_address: str | None = None
    phone_number: str | None = None
    email: str | None = None
    website: str | None = None
    bank_accounts: list[dict] = []
    directors: list[dict] = []
    authorized_capital: Decimal | None = None
    paid_up_capital: Decimal | None = None
    auditor_name: str | None = None
    auditor_firm_number: str | None = None
    financial_year_end: str | None = None
    logo_key: str | None = None
    logo_url: str | None = None  # presigned
    notes: str | None = None
    is_archived: bool = False
    created_at: datetime | None = None

    # Computed by the service, not stored on the row.
    document_count: int = 0
    asset_count: int = 0
    expiring_docs_count: int = 0  # licenses expiring within 90 days
    active_director_count: int = 0
    has_compliance_gap: bool = False  # no filing on record for the last closed FY


# ── Documents ────────────────────────────────────────────────────────────────


class CompanyDocumentCreate(BaseModel):
    category: str
    label: str
    financial_year: str | None = None
    storage_key: str
    file_name: str
    file_size_kb: int | None = None
    mime_type: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    notes: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in COMPANY_DOCUMENT_CATEGORIES:
            raise ValueError(f"Unknown document category '{v}'")
        return v


class CompanyDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    category: str
    label: str
    financial_year: str | None = None
    storage_key: str
    file_name: str
    file_size_kb: int | None = None
    mime_type: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None
    download_url: str | None = None  # presigned
    notes: str | None = None
    uploaded_at: datetime | None = None
    is_expiring: bool = False  # expiry within 90 days
    is_expired: bool = False


class CompanyDocumentUploadRequest(BaseModel):
    category: str = "other"
    file_name: str
    mime_type: str = "application/pdf"
    file_size_kb: int | None = None


class AssetCompanyLink(BaseModel):
    """Body of PATCH /assets/{id}/company — null detaches the property."""

    company_id: uuid.UUID | None = None
