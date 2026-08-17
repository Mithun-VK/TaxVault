import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_vault_owner_id, require
from app.core.permissions import (
    COMPANY_CREATE,
    COMPANY_DELETE,
    COMPANY_EDIT,
    COMPANY_VIEW,
)
from app.schemas import PaginatedResponse
from app.schemas.asset import AssetOut
from app.schemas.company import (
    CompanyCreate,
    CompanyDocumentCreate,
    CompanyDocumentResponse,
    CompanyDocumentUploadRequest,
    CompanyResponse,
    CompanyUpdate,
)
from app.services import company_service

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get(
    "/",
    response_model=PaginatedResponse[CompanyResponse],
    dependencies=[Depends(require(COMPANY_VIEW))],
)
async def list_companies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    items, total = await company_service.list_companies(db, vault_id, skip, limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post(
    "/",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require(COMPANY_CREATE))],
)
async def create_company(
    data: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.create_company(db, vault_id, data)


@router.get(
    "/{id}", response_model=CompanyResponse, dependencies=[Depends(require(COMPANY_VIEW))]
)
async def get_company(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.get_company(db, id, vault_id)


@router.patch(
    "/{id}", response_model=CompanyResponse, dependencies=[Depends(require(COMPANY_EDIT))]
)
async def update_company(
    id: uuid.UUID,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.update_company(db, id, vault_id, data)


@router.delete("/{id}", dependencies=[Depends(require(COMPANY_DELETE))])
async def archive_company(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.archive_company(db, id, vault_id)


# ── Documents ────────────────────────────────────────────────────────────────


@router.get(
    "/{id}/documents",
    response_model=list[CompanyDocumentResponse],
    dependencies=[Depends(require(COMPANY_VIEW))],
)
async def list_documents(
    id: uuid.UUID,
    category: str | None = Query(None),
    financial_year: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.list_company_documents(
        db, id, vault_id, category, financial_year
    )


@router.post(
    "/{id}/documents",
    response_model=CompanyDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require(COMPANY_CREATE))],
)
async def add_document(
    id: uuid.UUID,
    data: CompanyDocumentCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.add_company_document(db, id, vault_id, data)


@router.delete("/{id}/documents/{doc_id}", dependencies=[Depends(require(COMPANY_DELETE))])
async def delete_document(
    id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.delete_company_document(db, doc_id, id, vault_id)


@router.post("/{id}/documents/upload-url", dependencies=[Depends(require(COMPANY_CREATE))])
async def get_upload_url(
    id: uuid.UUID,
    data: CompanyDocumentUploadRequest,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await company_service.get_document_upload_url(
        db,
        id,
        vault_id,
        file_name=data.file_name,
        mime_type=data.mime_type,
        category=data.category,
        file_size_kb=data.file_size_kb,
    )


# ── Linked properties ────────────────────────────────────────────────────────


@router.get(
    "/{id}/assets",
    response_model=PaginatedResponse[AssetOut],
    dependencies=[Depends(require(COMPANY_VIEW))],
)
async def list_linked_assets(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    assets = await company_service.get_company_assets(db, id, vault_id)
    return {"items": assets, "total": len(assets), "skip": 0, "limit": len(assets)}
