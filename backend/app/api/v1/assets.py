import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import (
    PROPERTIES_CREATE,
    PROPERTIES_DELETE,
    PROPERTIES_EDIT,
    PROPERTIES_VIEW,
)
from app.schemas.asset import AssetCreate, AssetListResponse, AssetOut, AssetSummary, AssetUpdate
from app.schemas.company import AssetCompanyLink
from app.services import asset_service, company_service

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=AssetListResponse, dependencies=[Depends(require(PROPERTIES_VIEW))])
async def list_assets(
    asset_type: str | None = Query(None),
    status: str | None = Query(None),
    # Archived assets are hidden by default; reports opt in to include them.
    include_archived: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await asset_service.list_assets(
        db, vault_id, asset_type, status, skip, limit, include_archived
    )


@router.post(
    "/",
    response_model=AssetOut,
    status_code=201,
    dependencies=[Depends(require(PROPERTIES_CREATE))],
)
async def create_asset(
    payload: AssetCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await asset_service.create_asset(db, vault_id, payload)


@router.get(
    "/{asset_id}", response_model=AssetOut, dependencies=[Depends(require(PROPERTIES_VIEW))]
)
async def get_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await asset_service.get_asset(db, vault_id, asset_id)


@router.patch(
    "/{asset_id}", response_model=AssetOut, dependencies=[Depends(require(PROPERTIES_EDIT))]
)
async def update_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await asset_service.update_asset(db, vault_id, asset_id, payload)


@router.delete("/{asset_id}", status_code=200, dependencies=[Depends(require(PROPERTIES_DELETE))])
async def archive_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    await asset_service.archive_asset(db, vault_id, asset_id)
    return {"detail": "Asset archived successfully"}


@router.patch(
    "/{asset_id}/company",
    response_model=AssetOut,
    dependencies=[Depends(require(PROPERTIES_EDIT))],
)
async def link_asset_to_company(
    asset_id: uuid.UUID,
    payload: AssetCompanyLink,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    """Attach this property to a company, or detach it with `{"company_id": null}`."""
    return await company_service.link_asset_to_company(
        db, asset_id, payload.company_id, vault_id
    )


@router.get(
    "/{asset_id}/summary",
    response_model=AssetSummary,
    dependencies=[Depends(require(PROPERTIES_VIEW))],
)
async def asset_summary(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await asset_service.get_asset_summary(db, vault_id, asset_id)
