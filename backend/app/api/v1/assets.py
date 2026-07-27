import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.asset import AssetCreate, AssetListResponse, AssetOut, AssetSummary, AssetUpdate
from app.services import asset_service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=AssetListResponse)
async def list_assets(
    asset_type: str | None = Query(None),
    status: str | None = Query(None),
    # Archived assets are hidden by default; reports opt in to include them.
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.list_assets(
        db, current_user.id, asset_type, status, skip, limit, include_archived
    )


@router.post("/", response_model=AssetOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_asset(
    payload: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.create_asset(db, current_user.id, payload)


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.get_asset(db, current_user.id, asset_id)


@router.patch("/{asset_id}", response_model=AssetOut, dependencies=[Depends(require_admin)])
async def update_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.update_asset(db, current_user.id, asset_id, payload)


@router.delete("/{asset_id}", status_code=200, dependencies=[Depends(require_admin)])
async def archive_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await asset_service.archive_asset(db, current_user.id, asset_id)
    return {"detail": "Asset archived successfully"}


@router.get("/{asset_id}/summary", response_model=AssetSummary)
async def asset_summary(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await asset_service.get_asset_summary(db, current_user.id, asset_id)
