import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GoldCategoryCreate(BaseModel):
    # Slug stored on gold assets' metadata.category (matches the frontend
    # slugifyCategory output). Label is the human-readable display name.
    value: str = Field(pattern=r"^[a-z0-9_]{1,40}$")
    label: str = Field(min_length=1, max_length=80)


class GoldCategoryUpdate(BaseModel):
    label: str = Field(min_length=1, max_length=80)


class GoldCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    value: str
    label: str
    created_at: datetime


class GoldCategoryListResponse(BaseModel):
    items: list[GoldCategoryOut]
