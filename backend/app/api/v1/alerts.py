import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, get_vault_owner_id, require
from app.core.permissions import ALERTS_EDIT, ALERTS_VIEW
from app.models.user import User
from app.schemas.alert import (
    AlertBulkUpdateResult,
    AlertConfigBulkUpdate,
    AlertConfigListResponse,
    AlertConfigOut,
    AlertConfigUpdate,
    AlertLogListResponse,
    WhatsAppStatus,
    WhatsAppTestResult,
)
from app.services import alert_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get(
    "/configs", response_model=AlertConfigListResponse, dependencies=[Depends(require(ALERTS_VIEW))]
)
async def list_configs(
    entity_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await alert_service.list_configs(db, vault_id, entity_type, skip, limit)


@router.patch(
    "/configs",
    response_model=AlertBulkUpdateResult,
    dependencies=[Depends(require(ALERTS_EDIT))],
)
async def bulk_update_configs(
    payload: AlertConfigBulkUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    """Apply one setting to every rule at once.

    Declared before `/configs/{config_id}` so the literal path is matched first.
    """
    return await alert_service.bulk_update_configs(db, vault_id, payload)


@router.get(
    "/whatsapp",
    response_model=WhatsAppStatus,
    dependencies=[Depends(require(ALERTS_VIEW))],
)
async def whatsapp_status():
    """Whether Twilio can send, and to which (masked) number. Never returns
    the auth token."""
    return alert_service.whatsapp_status()


@router.post(
    "/whatsapp/test",
    response_model=WhatsAppTestResult,
    dependencies=[Depends(require(ALERTS_EDIT))],
)
async def send_whatsapp_test(current_user: User = Depends(get_current_user)):
    """Send a real WhatsApp message down the same path an alert takes."""
    return await alert_service.send_whatsapp_test(current_user.phone_number)


@router.get(
    "/configs/{config_id}",
    response_model=AlertConfigOut,
    dependencies=[Depends(require(ALERTS_VIEW))],
)
async def get_config(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await alert_service.get_config(db, vault_id, config_id)


@router.patch(
    "/configs/{config_id}",
    response_model=AlertConfigOut,
    dependencies=[Depends(require(ALERTS_EDIT))],
)
async def update_config(
    config_id: uuid.UUID,
    payload: AlertConfigUpdate,
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await alert_service.update_config(db, vault_id, config_id, payload)


@router.get(
    "/logs", response_model=AlertLogListResponse, dependencies=[Depends(require(ALERTS_VIEW))]
)
async def list_logs(
    entity_type: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    vault_id: uuid.UUID = Depends(get_vault_owner_id),
):
    return await alert_service.list_logs(db, vault_id, entity_type, status, skip, limit)
