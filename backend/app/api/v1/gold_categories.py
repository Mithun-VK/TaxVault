import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.gold_category import (
    GoldCategoryCreate,
    GoldCategoryListResponse,
    GoldCategoryOut,
    GoldCategoryUpdate,
)
from app.services import gold_category_service

router = APIRouter(prefix="/gold-categories", tags=["gold-categories"])


@router.get("/", response_model=GoldCategoryListResponse)
async def list_gold_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await gold_category_service.list_gold_categories(db, current_user.id)


@router.post(
    "/", response_model=GoldCategoryOut, status_code=201, dependencies=[Depends(require_admin)]
)
async def create_gold_category(
    payload: GoldCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await gold_category_service.create_gold_category(db, current_user.id, payload)


@router.patch(
    "/{category_id}", response_model=GoldCategoryOut, dependencies=[Depends(require_admin)]
)
async def update_gold_category(
    category_id: uuid.UUID,
    payload: GoldCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await gold_category_service.update_gold_category(
        db, current_user.id, category_id, payload
    )


@router.delete("/{category_id}", status_code=200, dependencies=[Depends(require_admin)])
async def delete_gold_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await gold_category_service.delete_gold_category(db, current_user.id, category_id)
    return {"detail": "Gold category deleted successfully"}
