import uuid

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import (
    INDIVIDUALS_CREATE,
    INDIVIDUALS_DELETE,
    INDIVIDUALS_EDIT,
    INDIVIDUALS_VIEW,
)
from app.schemas import PaginatedResponse
from app.schemas.asset import AssetOut
from app.schemas.individual import (
    IndividualCreate,
    IndividualResponse,
    IndividualUpdate,
)
from app.services import document_service, individual_service

router = APIRouter(prefix="/individuals", tags=["individuals"])


@router.get(
    "/",
    response_model=PaginatedResponse[IndividualResponse],
    dependencies=[Depends(require(INDIVIDUALS_VIEW))],
)
async def list_individuals(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    items, total = await individual_service.list_individuals(db, vault_id, skip, limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post(
    "/",
    response_model=IndividualResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require(INDIVIDUALS_CREATE))],
)
async def create_individual(
    data: IndividualCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await individual_service.create_individual(db, vault_id, data)


@router.get(
    "/{id}", response_model=IndividualResponse, dependencies=[Depends(require(INDIVIDUALS_VIEW))]
)
async def get_individual(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await individual_service.get_individual(db, id, vault_id)


@router.patch(
    "/{id}",
    response_model=IndividualResponse,
    dependencies=[Depends(require(INDIVIDUALS_EDIT))],
)
async def update_individual(
    id: uuid.UUID,
    data: IndividualUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await individual_service.update_individual(db, id, vault_id, data)


@router.delete("/{id}", dependencies=[Depends(require(INDIVIDUALS_DELETE))])
async def archive_individual(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await individual_service.archive_individual(db, id, vault_id)


@router.get(
    "/{id}/assets",
    response_model=PaginatedResponse[AssetOut],
    dependencies=[Depends(require(INDIVIDUALS_VIEW))],
)
async def get_individual_assets(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    assets = await individual_service.get_individual_assets(db, id, vault_id)
    return {"items": assets, "total": len(assets), "skip": 0, "limit": len(assets)}


@router.post("/{id}/documents/upload-url", dependencies=[Depends(require(INDIVIDUALS_CREATE))])
async def get_identity_doc_upload_url(
    id: uuid.UUID,
    data: dict = Body(...),  # {doc_type, file_name, mime_type}
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    # Verify the individual belongs to this vault (raises 404 otherwise).
    await individual_service.get_individual(db, id, vault_id)

    doc_type = data.get("doc_type", "other")
    file_name = data.get("file_name", "document.pdf")
    mime_type = data.get("mime_type", "application/pdf")
    document_service.validate_upload_request(mime_type, None)

    storage_key = f"individuals/{vault_id}/{id}/{doc_type}/{uuid.uuid4()}_{file_name}"
    upload_url = document_service.presign_put_for_key(storage_key, mime_type)
    return {"upload_url": upload_url, "storage_key": storage_key}
