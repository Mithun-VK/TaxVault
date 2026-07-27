from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard list-endpoint envelope: items plus pagination metadata."""

    items: list[T]
    total: int
    skip: int = 0
    limit: int = 20
