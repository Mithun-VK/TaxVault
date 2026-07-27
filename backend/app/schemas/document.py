import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.constants import DocumentCategory, EntityType


def _validate_tags(tags: list[str]) -> list[str]:
    for tag in tags:
        if not (1 <= len(tag) <= 50):
            raise ValueError("Each tag must be between 1 and 50 characters")
    return tags


class UploadUrlRequest(BaseModel):
    entity_type: EntityType | None = None
    entity_id: uuid.UUID | None = None
    file_name: str
    mime_type: str
    file_size_kb: int | None = None
    category: DocumentCategory = DocumentCategory.other


class UploadUrlResponse(BaseModel):
    upload_url: str
    storage_key: str


class DocumentCreate(BaseModel):
    entity_type: EntityType | None = None
    entity_id: uuid.UUID | None = None
    category: DocumentCategory = DocumentCategory.other
    label: str = Field(min_length=1, max_length=200)
    financial_year: str | None = Field(default=None, max_length=20)
    tags: list[str] = Field(default=[], max_length=10)
    storage_key: str = Field(max_length=1024)
    file_name: str | None = Field(default=None, max_length=512)
    file_size_kb: int | None = None
    mime_type: str | None = Field(default=None, max_length=200)

    _validate_tags = field_validator("tags")(_validate_tags)


class DocumentUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    category: DocumentCategory | None = None
    financial_year: str | None = Field(default=None, max_length=20)
    tags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("tags")
    @classmethod
    def _validate_update_tags(cls, v: list[str] | None) -> list[str] | None:
        return _validate_tags(v) if v is not None else v


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    entity_type: str | None
    entity_id: uuid.UUID | None
    category: str | None
    label: str
    financial_year: str | None
    tags: list[str]
    storage_key: str
    file_name: str | None
    file_size_kb: int | None
    mime_type: str | None
    uploaded_at: datetime
    is_deleted: bool


class DocumentDownloadResponse(BaseModel):
    download_url: str


class DocumentListResponse(BaseModel):
    items: list[DocumentOut]
    total: int
    skip: int
    limit: int
