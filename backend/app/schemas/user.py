import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["admin", "user"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    phone_number: str | None
    device_tokens: list
    is_active: bool
    role: Role
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    phone_number: str | None = Field(default=None, max_length=20)
    device_tokens: list | None = Field(default=None, max_length=50)


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(max_length=128)


class RoleUpdate(BaseModel):
    role: Role


class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int
