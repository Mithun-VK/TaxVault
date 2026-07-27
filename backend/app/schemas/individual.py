import re
import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class VisaEntry(BaseModel):
    country: str
    visa_type: str  # "Tourist" | "Residence" | "Work" | "Student" | "Transit" | "Other"
    visa_number: str | None = None
    issue_date: date | None = None
    expiry_date: date | None = None


class IndividualCreate(BaseModel):
    full_name: str
    date_of_birth: date | None = None
    relationship_to_owner: str | None = None
    phone_number: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    aadhaar_number: str | None = None
    pan_number: str | None = None
    passport_number: str | None = None
    passport_expiry: date | None = None
    driving_license_number: str | None = None
    voter_id_number: str | None = None
    skywards_number: str | None = None
    maharaja_number: str | None = None
    indigo_chip_number: str | None = None
    visas: list[VisaEntry] = []
    notes: str | None = None

    @field_validator("aadhaar_number")
    @classmethod
    def validate_aadhaar(cls, v: str | None) -> str | None:
        if v and (not v.isdigit() or len(v) != 12):
            raise ValueError("Aadhaar number must be exactly 12 digits")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        if v and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", v.upper()):
            raise ValueError("PAN must be in format ABCDE1234F")
        return v.upper() if v else v


class IndividualUpdate(BaseModel):
    full_name: str | None = None
    date_of_birth: date | None = None
    relationship_to_owner: str | None = None
    phone_number: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    photo_key: str | None = None
    aadhaar_number: str | None = None
    aadhaar_photo_key: str | None = None
    pan_number: str | None = None
    pan_photo_key: str | None = None
    passport_number: str | None = None
    passport_expiry: date | None = None
    passport_photo_key: str | None = None
    driving_license_number: str | None = None
    voter_id_number: str | None = None
    skywards_number: str | None = None
    maharaja_number: str | None = None
    indigo_chip_number: str | None = None
    visas: list[VisaEntry] | None = None
    notes: str | None = None

    @field_validator("aadhaar_number")
    @classmethod
    def validate_aadhaar(cls, v: str | None) -> str | None:
        if v and (not v.isdigit() or len(v) != 12):
            raise ValueError("Aadhaar number must be exactly 12 digits")
        return v

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: str | None) -> str | None:
        if v and not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", v.upper()):
            raise ValueError("PAN must be in format ABCDE1234F")
        return v.upper() if v else v


class IndividualResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    date_of_birth: date | None = None
    relationship_to_owner: str | None = None
    phone_number: str | None = None
    email: str | None = None
    address: str | None = None
    photo_key: str | None = None
    photo_url: str | None = None
    aadhaar_number: str | None = None
    aadhaar_photo_url: str | None = None
    pan_number: str | None = None
    pan_photo_url: str | None = None
    passport_number: str | None = None
    passport_expiry: date | None = None
    passport_photo_url: str | None = None
    driving_license_number: str | None = None
    voter_id_number: str | None = None
    skywards_number: str | None = None
    maharaja_number: str | None = None
    indigo_chip_number: str | None = None
    visas: list[dict] = []
    notes: str | None = None
    is_archived: bool = False
    created_at: datetime | None = None

    # Computed by the service, not stored on the row.
    asset_count: int = 0
    active_visa_count: int = 0
    has_expiring_docs: bool = False
