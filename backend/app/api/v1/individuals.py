import uuid

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas import PaginatedResponse
from app.schemas.asset import AssetOut
from app.schemas.individual import (
    IndividualCreate,
    IndividualResponse,
    IndividualUpdate,
)
from app.services import document_service, individual_service

router = APIRouter(prefix="/individuals", tags=["individuals"])


@router.get("/", response_model=PaginatedResponse[IndividualResponse])
async def list_individuals(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = await individual_service.list_individuals(
        db, current_user.id, skip, limit
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post(
    "/",
    response_model=IndividualResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_individual(
    data: IndividualCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await individual_service.create_individual(db, current_user.id, data)


@router.get("/{id}", response_model=IndividualResponse)
async def get_individual(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await individual_service.get_individual(db, id, current_user.id)


@router.patch(
    "/{id}",
    response_model=IndividualResponse,
    dependencies=[Depends(require_admin)],
)
async def update_individual(
    id: uuid.UUID,
    data: IndividualUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await individual_service.update_individual(db, id, current_user.id, data)


@router.delete("/{id}", dependencies=[Depends(require_admin)])
async def archive_individual(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await individual_service.archive_individual(db, id, current_user.id)


@router.get("/{id}/assets", response_model=PaginatedResponse[AssetOut])
async def get_individual_assets(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assets = await individual_service.get_individual_assets(db, id, current_user.id)
    return {"items": assets, "total": len(assets), "skip": 0, "limit": len(assets)}


@router.post("/{id}/documents/upload-url", dependencies=[Depends(require_admin)])
async def get_identity_doc_upload_url(
    id: uuid.UUID,
    data: dict = Body(...),  # {doc_type, file_name, mime_type}
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify ownership (raises 404 if not this user's individual).
    await individual_service.get_individual(db, id, current_user.id)

    doc_type = data.get("doc_type", "other")
    file_name = data.get("file_name", "document.pdf")
    mime_type = data.get("mime_type", "application/pdf")
    document_service.validate_upload_request(mime_type, None)

    storage_key = (
        f"individuals/{current_user.id}/{id}/{doc_type}/{uuid.uuid4()}_{file_name}"
    )
    upload_url = document_service.presign_put_for_key(storage_key, mime_type)
    return {"upload_url": upload_url, "storage_key": storage_key}
