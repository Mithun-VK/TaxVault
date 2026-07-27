import uuid
from pathlib import Path

import boto3
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import AuditAction
from app.core.exceptions import AppException, NotFoundError
from app.core.ownership import verify_entity_ownership
from app.models.document import Document
from app.schemas.document import (
    DocumentCreate,
    DocumentListResponse,
    DocumentOut,
    DocumentUpdate,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.audit_service import log_audit

# Reuse a single boto3 client across calls (connection pooling + lower latency).
_r2_client = None


def _get_r2_client():  # type: ignore[no-untyped-def]
    global _r2_client
    if _r2_client is None:
        _r2_client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
        )
    return _r2_client


# ── Local filesystem fallback (used when R2 is not configured) ─────────────────
# Files land under settings.LOCAL_STORAGE_DIR, mirroring the R2 key layout:
#   {user_id}/{entity_type}/{entity_id}/{uuid}_{file_name}
#   {user_id}/library/{category}/{uuid}_{file_name}
# The browser uploads/downloads them via /api/v1/documents/blob/{storage_key}.
def _local_storage_root() -> Path:
    root = Path(settings.LOCAL_STORAGE_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def local_path_for_key(storage_key: str) -> Path:
    """Resolve a storage key to an absolute path, guarding against traversal."""
    root = _local_storage_root()
    target = (root / storage_key).resolve()
    if root not in target.parents and target != root:
        raise AppException(status_code=400, detail="Invalid storage key.")
    return target


def _local_blob_url(storage_key: str) -> str:
    """Same-origin URL the browser PUTs to / GETs from for a local blob."""
    return f"/api/v1/documents/blob/{storage_key}"


def save_local_blob(storage_key: str, data: bytes) -> None:
    path = local_path_for_key(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read_local_blob(storage_key: str) -> bytes | None:
    path = local_path_for_key(storage_key)
    return path.read_bytes() if path.is_file() else None


def validate_upload_request(mime_type: str, file_size_kb: int | None) -> None:
    if file_size_kb is not None:
        max_kb = settings.MAX_UPLOAD_SIZE_MB * 1024
        if file_size_kb > max_kb:
            raise AppException(
                status_code=413,
                detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB.",
            )
    if mime_type not in settings.ALLOWED_MIME_TYPES:
        raise AppException(
            status_code=415,
            detail=(
                f"File type '{mime_type}' is not allowed. "
                "Allowed types: PDF, JPEG, PNG, WEBP, DOC, DOCX."
            ),
        )


def _build_storage_key(
    user_id: uuid.UUID,
    file_name: str,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    category: str,
) -> str:
    suffix = f"{uuid.uuid4()}_{file_name}"
    if entity_type and entity_id:
        return f"{user_id}/{entity_type}/{entity_id}/{suffix}"
    return f"{user_id}/library/{category}/{suffix}"


async def generate_upload_url(
    db: AsyncSession,
    user_id: uuid.UUID,
    payload: UploadUrlRequest,
) -> UploadUrlResponse:
    validate_upload_request(payload.mime_type, payload.file_size_kb)
    if payload.entity_type and payload.entity_id:
        await verify_entity_ownership(db, payload.entity_type.value, payload.entity_id, user_id)
    storage_key = _build_storage_key(
        user_id, payload.file_name, payload.entity_type, payload.entity_id, payload.category.value
    )
    if not settings.r2_configured:
        return UploadUrlResponse(upload_url=_local_blob_url(storage_key), storage_key=storage_key)
    client = _get_r2_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": storage_key,
            "ContentType": payload.mime_type,
        },
        ExpiresIn=settings.R2_PRESIGN_EXPIRY,
    )
    return UploadUrlResponse(upload_url=url, storage_key=storage_key)


async def create_document(
    db: AsyncSession, user_id: uuid.UUID, payload: DocumentCreate
) -> DocumentOut:
    if payload.entity_type and payload.entity_id:
        await verify_entity_ownership(db, payload.entity_type.value, payload.entity_id, user_id)
    doc = Document(user_id=user_id, **payload.model_dump())
    db.add(doc)
    await db.flush()
    await log_audit(db, user_id, AuditAction.create, "document", doc.id, payload.model_dump())
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


async def list_documents(
    db: AsyncSession,
    user_id: uuid.UUID,
    category: str | None,
    entity_type: str | None,
    entity_id: uuid.UUID | None,
    skip: int,
    limit: int,
) -> DocumentListResponse:
    q = select(Document).where(Document.user_id == user_id, Document.is_deleted == False)
    if category:
        q = q.where(Document.category == category)
    if entity_type:
        q = q.where(Document.entity_type == entity_type)
    if entity_id:
        q = q.where(Document.entity_id == entity_id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.order_by(Document.uploaded_at.desc()).offset(skip).limit(limit))
    return DocumentListResponse(
        items=[DocumentOut.model_validate(d) for d in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


def presign_get_for_key(storage_key: str | None) -> str | None:
    """Presigned GET URL for an arbitrary R2 key (e.g. an identity-doc photo).

    Returns None when there is no key, so callers can pass a nullable column
    straight through.
    """
    if not storage_key:
        return None
    if not settings.r2_configured:
        return _local_blob_url(storage_key)
    client = _get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": storage_key},
        ExpiresIn=settings.R2_PRESIGN_EXPIRY,
    )


def presign_put_for_key(storage_key: str, mime_type: str) -> str:
    """Presigned PUT URL for uploading directly to an explicit R2 key."""
    if not settings.r2_configured:
        return _local_blob_url(storage_key)
    client = _get_r2_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET_NAME,
            "Key": storage_key,
            "ContentType": mime_type,
        },
        ExpiresIn=settings.R2_PRESIGN_EXPIRY,
    )


async def get_download_url(db: AsyncSession, user_id: uuid.UUID, document_id: uuid.UUID) -> str:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user_id, Document.is_deleted == False
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document not found")

    if not settings.r2_configured:
        return _local_blob_url(doc.storage_key)
    client = _get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": doc.storage_key},
        ExpiresIn=settings.R2_PRESIGN_EXPIRY,
    )


async def update_document(
    db: AsyncSession, user_id: uuid.UUID, document_id: uuid.UUID, payload: DocumentUpdate
) -> DocumentOut:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user_id, Document.is_deleted == False
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document not found")

    old_vals: dict = {}
    for k, v in payload.model_dump(exclude_none=True).items():
        old_vals[k] = {"old": getattr(doc, k), "new": v}
        setattr(doc, k, v)

    await log_audit(db, user_id, AuditAction.update, "document", doc.id, old_vals)
    await db.commit()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


async def soft_delete_document(
    db: AsyncSession, user_id: uuid.UUID, document_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user_id, Document.is_deleted == False
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise NotFoundError("Document not found")
    doc.is_deleted = True
    await log_audit(db, user_id, AuditAction.delete, "document", doc.id)
    await db.commit()


async def search_documents(
    db: AsyncSession,
    user_id: uuid.UUID,
    query: str,
    skip: int,
    limit: int,
) -> DocumentListResponse:
    q = select(Document).where(
        Document.user_id == user_id,
        Document.is_deleted == False,
        or_(
            Document.label.ilike(f"%{query}%"),
            Document.tags.any(query),  # type: ignore[arg-type]  # PG ARRAY membership
        ),
    )
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(q.offset(skip).limit(limit))
    return DocumentListResponse(
        items=[DocumentOut.model_validate(d) for d in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )
