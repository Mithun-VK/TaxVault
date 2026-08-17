"""Maker/checker queue for members.

A member may add bills, taxes and insurance policies outright, but changing or
removing one is not theirs to do. Instead they file a change request here; an
admin or super admin approves it, and only then is the change applied — through
exactly the same service call a super admin's own edit would take, so approved
changes cannot diverge from direct ones.

Three rules keep the queue honest:

* the payload is validated against the entity's real update schema **when the
  request is filed**, so a reviewer is never shown a change that would fail on
  apply, and an approval can never write unvalidated data;
* the target is re-checked against the vault at approval time, so a record
  deleted in the meantime rejects cleanly instead of erroring;
* a request nobody reviews within ``CHANGE_REQUEST_TTL_MINUTES`` expires, so
  a stale edit cannot be approved long after the record has moved on.
"""

import uuid
from datetime import datetime, timedelta, timezone

from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.display_names import (
    bill_display_name,
    insurance_display_name,
    tax_display_name,
)
from app.core.exceptions import AppException, NotFoundError, PermissionDeniedError
from app.core.permissions import CHANGE_REQUESTS_REVIEW, has_permission
from app.models.change_request import ChangeRequest
from app.models.insurance import InsurancePolicy
from app.models.recurring_bill import RecurringBill
from app.models.tax_obligation import TaxObligation
from app.models.user import User
from app.schemas.change_request import (
    ChangeRequestCreate,
    ChangeRequestListResponse,
    ChangeRequestOut,
)
from app.schemas.insurance import InsuranceUpdate
from app.schemas.recurring_bill import BillUpdate
from app.schemas.tax_obligation import TaxUpdate
from app.services import bill_service, insurance_service, tax_service

STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUS_CANCELLED = "cancelled"
STATUS_EXPIRED = "expired"

# entity_type -> (model, update schema, label fn, update fn, delete fn)
_ENTITIES = {
    "bill": (
        RecurringBill,
        BillUpdate,
        bill_display_name,
        bill_service.update_bill,
        bill_service.deactivate_bill,
    ),
    "tax": (
        TaxObligation,
        TaxUpdate,
        tax_display_name,
        tax_service.update_tax,
        tax_service.archive_tax,
    ),
    "insurance": (
        InsurancePolicy,
        InsuranceUpdate,
        insurance_display_name,
        insurance_service.update_insurance,
        insurance_service.archive_insurance,
    ),
}


async def _expire_stale(db: AsyncSession, vault_id: uuid.UUID) -> None:
    """Lapse any pending request past its deadline.

    Done on read and on review rather than by a background job, so expiry is
    exact at the moment it matters: a reviewer can never approve a request the
    queue would already show as expired, whether or not a worker is running.
    """
    result = await db.execute(
        update(ChangeRequest)
        .where(
            ChangeRequest.user_id == vault_id,
            ChangeRequest.status == STATUS_PENDING,
            ChangeRequest.expires_at.is_not(None),
            ChangeRequest.expires_at < datetime.now(timezone.utc),
        )
        .values(status=STATUS_EXPIRED)
    )
    if result.rowcount:
        await db.commit()


async def _load_target(db: AsyncSession, vault_id: uuid.UUID, entity_type: str, entity_id):
    """The targeted row, or None if it is not in this vault (or is gone)."""
    model = _ENTITIES[entity_type][0]
    result = await db.execute(
        select(model).where(model.id == entity_id, model.user_id == vault_id)
    )
    return result.scalar_one_or_none()


async def _to_out(db: AsyncSession, req: ChangeRequest) -> ChangeRequestOut:
    out = ChangeRequestOut.model_validate(req)

    target = await _load_target(db, req.user_id, req.entity_type, req.entity_id)
    if target is not None:
        out.entity_label = _ENTITIES[req.entity_type][2](target)

    ids = [i for i in (req.requested_by_id, req.reviewed_by_id) if i]
    names = dict(
        (await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))).all()
    )
    out.requested_by_name = names.get(req.requested_by_id)
    out.reviewed_by_name = names.get(req.reviewed_by_id) if req.reviewed_by_id else None
    return out


async def create_change_request(
    db: AsyncSession,
    vault_id: uuid.UUID,
    requester: User,
    payload: ChangeRequestCreate,
) -> ChangeRequestOut:
    target = await _load_target(db, vault_id, payload.entity_type, payload.entity_id)
    if target is None:
        raise NotFoundError(f"{payload.entity_type.capitalize()} not found.")

    if payload.action == "delete":
        if payload.payload:
            raise AppException(
                status_code=400, detail="A delete request cannot carry a payload."
            )
    else:
        update_schema = _ENTITIES[payload.entity_type][1]
        try:
            validated = update_schema.model_validate(payload.payload)
        except ValidationError as exc:
            raise AppException(
                status_code=422, detail=f"Requested change is not valid: {exc.errors()[0]['msg']}"
            ) from exc
        if not validated.model_dump(exclude_unset=True):
            raise AppException(status_code=400, detail="No changes were requested.")

    req = ChangeRequest(
        user_id=vault_id,
        requested_by_id=requester.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        action=payload.action,
        payload=payload.payload,
        reason=payload.reason,
        status=STATUS_PENDING,
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=settings.CHANGE_REQUEST_TTL_MINUTES),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return await _to_out(db, req)


async def list_change_requests(
    db: AsyncSession,
    vault_id: uuid.UUID,
    viewer: User,
    status: str | None,
    skip: int,
    limit: int,
) -> ChangeRequestListResponse:
    await _expire_stale(db, vault_id)

    q = select(ChangeRequest).where(ChangeRequest.user_id == vault_id)
    if status:
        q = q.where(ChangeRequest.status == status)
    # Reviewers see the whole queue; everyone else only what they filed.
    if not has_permission(viewer.role, CHANGE_REQUESTS_REVIEW):
        q = q.where(ChangeRequest.requested_by_id == viewer.id)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    result = await db.execute(
        q.order_by(ChangeRequest.created_at.desc()).offset(skip).limit(limit)
    )
    items = [await _to_out(db, r) for r in result.scalars()]
    return ChangeRequestListResponse(items=items, total=total, skip=skip, limit=limit)


async def _get_pending(
    db: AsyncSession, vault_id: uuid.UUID, request_id: uuid.UUID
) -> ChangeRequest:
    # Lapse overdue rows first, so a request past its deadline reports as
    # expired instead of being approved a moment too late.
    await _expire_stale(db, vault_id)

    result = await db.execute(
        select(ChangeRequest).where(
            ChangeRequest.id == request_id, ChangeRequest.user_id == vault_id
        )
    )
    req = result.scalar_one_or_none()
    if req is None:
        raise NotFoundError("Change request not found.")
    if req.status != STATUS_PENDING:
        raise AppException(
            status_code=409, detail=f"This request has already been {req.status}."
        )
    return req


async def approve(
    db: AsyncSession,
    vault_id: uuid.UUID,
    reviewer: User,
    request_id: uuid.UUID,
    note: str | None,
) -> ChangeRequestOut:
    req = await _get_pending(db, vault_id, request_id)

    if await _load_target(db, vault_id, req.entity_type, req.entity_id) is None:
        raise AppException(
            status_code=409,
            detail="The record this request targets no longer exists. Reject it instead.",
        )

    _, update_schema, _, update_fn, delete_fn = _ENTITIES[req.entity_type]
    if req.action == "delete":
        await delete_fn(db, vault_id, req.entity_id)
    else:
        await update_fn(db, vault_id, req.entity_id, update_schema.model_validate(req.payload))

    req.status = STATUS_APPROVED
    req.reviewed_by_id = reviewer.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_note = note
    req.expires_at = None
    await db.commit()
    await db.refresh(req)
    return await _to_out(db, req)


async def reject(
    db: AsyncSession,
    vault_id: uuid.UUID,
    reviewer: User,
    request_id: uuid.UUID,
    note: str | None,
) -> ChangeRequestOut:
    req = await _get_pending(db, vault_id, request_id)
    req.status = STATUS_REJECTED
    req.reviewed_by_id = reviewer.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.review_note = note
    req.expires_at = None
    await db.commit()
    await db.refresh(req)
    return await _to_out(db, req)


async def cancel(
    db: AsyncSession, vault_id: uuid.UUID, requester: User, request_id: uuid.UUID
) -> ChangeRequestOut:
    """Withdraw one's own pending request."""
    req = await _get_pending(db, vault_id, request_id)
    if req.requested_by_id != requester.id:
        raise PermissionDeniedError("You can only withdraw your own requests.")

    req.status = STATUS_CANCELLED
    req.reviewed_at = datetime.now(timezone.utc)
    req.expires_at = None
    await db.commit()
    await db.refresh(req)
    return await _to_out(db, req)
