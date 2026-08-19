import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, get_vault_owner_id, require
from app.core.exceptions import PermissionDeniedError
from app.core.permissions import (
    CHANGE_REQUESTS_REVIEW,
    CHANGE_REQUESTS_VIEW,
    REQUEST_CHANGE_PERMISSION,
    has_permission,
)
from app.models.user import User
from app.schemas.change_request import (
    ChangeRequestCreate,
    ChangeRequestListResponse,
    ChangeRequestOut,
    ChangeRequestReview,
)
from app.services import change_request_service

router = APIRouter(prefix="/change-requests", tags=["change-requests"])


@router.get(
    "/",
    response_model=ChangeRequestListResponse,
    dependencies=[Depends(require(CHANGE_REQUESTS_VIEW))],
)
async def list_change_requests(
    status: str | None = Query(None, description="pending, approved, rejected or cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
    current_user: User = Depends(get_current_user),
):
    """The approval queue. Reviewers see every request; a member sees only the
    ones they filed (enforced in the service)."""
    return await change_request_service.list_change_requests(
        db, vault_id, current_user, status, skip, limit
    )


@router.post("/", response_model=ChangeRequestOut, status_code=201)
async def create_change_request(
    payload: ChangeRequestCreate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
    current_user: User = Depends(get_current_user),
):
    """File an edit or delete for approval.

    Gated per entity type, because the permission depends on what is being
    changed - a role that may edit the record directly has no business here.
    """
    permission = REQUEST_CHANGE_PERMISSION[payload.entity_type]
    if not has_permission(current_user.role, permission):
        raise PermissionDeniedError(
            f"Your role ({current_user.role}) cannot request changes to a {payload.entity_type}"
        )
    return await change_request_service.create_change_request(
        db, vault_id, current_user, payload
    )


@router.post(
    "/{request_id}/approve",
    response_model=ChangeRequestOut,
    dependencies=[Depends(require(CHANGE_REQUESTS_REVIEW))],
)
async def approve_change_request(
    request_id: uuid.UUID,
    payload: ChangeRequestReview | None = None,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
    current_user: User = Depends(get_current_user),
):
    """Approve and apply. The change goes through the same service call a super
    admin's own edit would take."""
    return await change_request_service.approve(
        db, vault_id, current_user, request_id, payload.note if payload else None
    )


@router.post(
    "/{request_id}/reject",
    response_model=ChangeRequestOut,
    dependencies=[Depends(require(CHANGE_REQUESTS_REVIEW))],
)
async def reject_change_request(
    request_id: uuid.UUID,
    payload: ChangeRequestReview | None = None,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
    current_user: User = Depends(get_current_user),
):
    return await change_request_service.reject(
        db, vault_id, current_user, request_id, payload.note if payload else None
    )


@router.post(
    "/{request_id}/cancel",
    response_model=ChangeRequestOut,
    dependencies=[Depends(require(CHANGE_REQUESTS_VIEW))],
)
async def cancel_change_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
    current_user: User = Depends(get_current_user),
):
    """Withdraw one's own pending request."""
    return await change_request_service.cancel(db, vault_id, current_user, request_id)
