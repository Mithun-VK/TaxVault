import mimetypes
import uuid

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db, require_admin
from app.core.exceptions import AppException, NotFoundError
from app.models.user import User
from app.schemas.document import (
    DocumentCreate,
    DocumentDownloadResponse,
    DocumentListResponse,
    DocumentOut,
    DocumentUpdate,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services import document_service

router = APIRouter(prefix="/documents", tags=["documents"])


# ── Local storage blob endpoints ──────────────────────────────────────────────
# Used only when R2 is NOT configured (see document_service). When R2 is
# configured these routes are never handed out. The upload (PUT) requires
# authentication and confines writes to the caller's own {user_id}/ namespace,
# so an anonymous or cross-user caller cannot write arbitrary files. GET is the
# read/serve half handled separately (browsers fetch it via <img>/<iframe>, so
# it cannot carry an Authorization header).
@router.put("/blob/{storage_key:path}", status_code=200)
async def put_blob(
    storage_key: str,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    if settings.r2_configured:
        raise NotFoundError("Not found")

    # Confine writes to the authenticated user's own prefix. The storage key
    # layout is {user_id}/... (see document_service._build_storage_key), so a
    # valid key must begin with this user's id. This blocks anonymous writes
    # (no auth → no user) and cross-user writes (wrong prefix).
    if storage_key != str(current_user.id) and not storage_key.startswith(
        f"{current_user.id}/"
    ):
        raise AppException(status_code=403, detail="Forbidden storage key.")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # Reject oversized uploads by Content-Length before buffering the body, so a
    # single huge request cannot be read fully into memory.
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            declared = int(content_length)
        except ValueError:
            raise AppException(status_code=400, detail="Invalid Content-Length.")
        if declared > max_bytes:
            raise AppException(
                status_code=413,
                detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB.",
            )

    # Enforce the MIME allow-list at write time, inferred from the key's
    # extension (the same allow-list applied when the upload URL was issued).
    guessed_type = mimetypes.guess_type(storage_key)[0]
    if guessed_type not in settings.ALLOWED_MIME_TYPES:
        raise AppException(
            status_code=415,
            detail="File type is not allowed.",
        )

    body = await request.body()
    if len(body) > max_bytes:
        raise AppException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )
    document_service.save_local_blob(storage_key, body)
    return {"detail": "ok"}


@router.get("/blob/{storage_key:path}")
async def get_blob(storage_key: str):
    if settings.r2_configured:
        raise NotFoundError("Not found")
    data = document_service.read_local_blob(storage_key)
    if data is None:
        raise NotFoundError("File not found")
    content_type = mimetypes.guess_type(storage_key)[0] or "application/octet-stream"
    filename = storage_key.rsplit("/", 1)[-1]
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post(
    "/upload-url",
    response_model=UploadUrlResponse,
    summary="Get a presigned upload URL",
    dependencies=[Depends(require_admin)],
)
async def get_upload_url(
    payload: UploadUrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await document_service.generate_upload_url(db, current_user.id, payload)


@router.post("/", response_model=DocumentOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_document(
    payload: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await document_service.create_document(db, current_user.id, payload)


@router.get("/search", response_model=DocumentListResponse)
async def search_documents(
    q: str = Query(...),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await document_service.search_documents(db, current_user.id, q, skip, limit)


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    category: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await document_service.list_documents(
        db, current_user.id, category, entity_type, entity_id, skip, limit
    )


@router.get("/{document_id}/download", response_model=DocumentDownloadResponse)
async def get_download_url(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    url = await document_service.get_download_url(db, current_user.id, document_id)
    return DocumentDownloadResponse(download_url=url)


@router.patch("/{document_id}", response_model=DocumentOut, dependencies=[Depends(require_admin)])
async def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await document_service.update_document(db, current_user.id, document_id, payload)


@router.delete("/{document_id}", status_code=200, dependencies=[Depends(require_admin)])
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await document_service.soft_delete_document(db, current_user.id, document_id)
    return {"detail": "Document deleted successfully"}
