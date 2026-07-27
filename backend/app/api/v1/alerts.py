import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db, require_admin
from app.models.user import User
from app.schemas.alert import (
    AlertConfigListResponse,
    AlertConfigOut,
    AlertConfigUpdate,
    AlertLogListResponse,
)
from app.services import alert_service

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/configs", response_model=AlertConfigListResponse)
async def list_configs(
    entity_type: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await alert_service.list_configs(db, current_user.id, entity_type, skip, limit)


@router.get("/configs/{config_id}", response_model=AlertConfigOut)
async def get_config(
    config_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await alert_service.get_config(db, current_user.id, config_id)


@router.patch("/configs/{config_id}", response_model=AlertConfigOut, dependencies=[Depends(require_admin)])
async def update_config(
    config_id: uuid.UUID,
    payload: AlertConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await alert_service.update_config(db, current_user.id, config_id, payload)


@router.get("/logs", response_model=AlertLogListResponse)
async def list_logs(
    entity_type: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await alert_service.list_logs(db, current_user.id, entity_type, status, skip, limit)
