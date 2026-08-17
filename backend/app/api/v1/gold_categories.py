import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import (
    GOLD_CATEGORIES_CREATE,
    GOLD_CATEGORIES_DELETE,
    GOLD_CATEGORIES_EDIT,
    GOLD_CATEGORIES_VIEW,
)
from app.schemas.gold_category import (
    GoldCategoryCreate,
    GoldCategoryListResponse,
    GoldCategoryOut,
    GoldCategoryUpdate,
)
from app.services import gold_category_service

router = APIRouter(prefix="/gold-categories", tags=["gold-categories"])


@router.get(
    "/",
    response_model=GoldCategoryListResponse,
    dependencies=[Depends(require(GOLD_CATEGORIES_VIEW))],
)
async def list_gold_categories(
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await gold_category_service.list_gold_categories(db, vault_id)


@router.post(
    "/",
    response_model=GoldCategoryOut,
    status_code=201,
    dependencies=[Depends(require(GOLD_CATEGORIES_CREATE))],
)
async def create_gold_category(
    payload: GoldCategoryCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await gold_category_service.create_gold_category(db, vault_id, payload)


@router.patch(
    "/{category_id}",
    response_model=GoldCategoryOut,
    dependencies=[Depends(require(GOLD_CATEGORIES_EDIT))],
)
async def update_gold_category(
    category_id: uuid.UUID,
    payload: GoldCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await gold_category_service.update_gold_category(db, vault_id, category_id, payload)


@router.delete(
    "/{category_id}", status_code=200, dependencies=[Depends(require(GOLD_CATEGORIES_DELETE))]
)
async def delete_gold_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    await gold_category_service.delete_gold_category(db, vault_id, category_id)
    return {"detail": "Gold category deleted successfully"}
