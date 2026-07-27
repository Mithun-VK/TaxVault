import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AuditAction, ObligationStatus
from app.core.exceptions import NotFoundError
from app.models.asset import Asset
from app.models.document import Document
from app.models.payment import Payment
from app.models.tax_obligation import TaxObligation
from app.schemas.asset import AssetCreate, AssetListResponse, AssetOut, AssetSummary, AssetUpdate
from app.services.audit_service import log_audit


async def list_assets(
    db: AsyncSession,
    user_id: uuid.UUID,
    asset_type: str | None,
    status: str | None,
    skip: int,
    limit: int,
    include_archived: bool = False,
) -> AssetListResponse:
    q = select(Asset).where(Asset.user_id == user_id)
    if not include_archived:
        q = q.where(Asset.is_archived == False)
    if asset_type:
        q = q.where(Asset.asset_type == asset_type)
    if status:
        q = q.where(Asset.status == status)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    result = await db.execute(q.offset(skip).limit(limit))
    return AssetListResponse(
        items=[AssetOut.model_validate(a) for a in result.scalars()],
        total=total,
        skip=skip,
        limit=limit,
    )


async def create_asset(db: AsyncSession, user_id: uuid.UUID, payload: AssetCreate) -> AssetOut:
    asset = Asset(user_id=user_id, **payload.model_dump())
    db.add(asset)
    await db.flush()
    await log_audit(db, user_id, AuditAction.create, "asset", asset.id, payload.model_dump())
    await db.commit()
    await db.refresh(asset)
    return AssetOut.model_validate(asset)


async def get_asset(db: AsyncSession, user_id: uuid.UUID, asset_id: uuid.UUID) -> AssetOut:
    result = await db.execute(
        select(Asset).where(
            Asset.id == asset_id, Asset.user_id == user_id, Asset.is_archived == False
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundError("Asset not found")
    return AssetOut.model_validate(asset)


async def update_asset(
    db: AsyncSession, user_id: uuid.UUID, asset_id: uuid.UUID, payload: AssetUpdate
) -> AssetOut:
    result = await db.execute(
        select(Asset).where(
            Asset.id == asset_id, Asset.user_id == user_id, Asset.is_archived == False
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundError("Asset not found")

    old_vals: dict = {}
    updates = payload.model_dump(exclude_none=True)
    for k, v in updates.items():
        old_vals[k] = {"old": getattr(asset, k), "new": v}
        setattr(asset, k, v)

    await log_audit(db, user_id, AuditAction.update, "asset", asset.id, old_vals)
    await db.commit()
    await db.refresh(asset)
    return AssetOut.model_validate(asset)


async def archive_asset(db: AsyncSession, user_id: uuid.UUID, asset_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Asset).where(
            Asset.id == asset_id, Asset.user_id == user_id, Asset.is_archived == False
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise NotFoundError("Asset not found")
    asset.is_archived = True
    await log_audit(db, user_id, AuditAction.delete, "asset", asset.id)
    await db.commit()


async def get_asset_summary(
    db: AsyncSession, user_id: uuid.UUID, asset_id: uuid.UUID
) -> AssetSummary:
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.user_id == user_id))
    if not result.scalar_one_or_none():
        raise NotFoundError("Asset not found")

    tax_q = select(TaxObligation.id).where(
        TaxObligation.asset_id == asset_id, TaxObligation.user_id == user_id
    )
    tax_ids = (await db.execute(tax_q)).scalars().all()

    paid = Decimal("0")
    pending = Decimal("0")
    if tax_ids:
        paid_q = select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
            Payment.entity_type == "tax",
            Payment.entity_id.in_(tax_ids),
            Payment.user_id == user_id,
        )
        paid = Decimal(str((await db.execute(paid_q)).scalar_one()))

        pending_q = select(func.coalesce(func.sum(TaxObligation.total_amount), 0)).where(
            TaxObligation.id.in_(tax_ids),
            TaxObligation.status == ObligationStatus.pending.value,
        )
        pending = Decimal(str((await db.execute(pending_q)).scalar_one()))

    docs_q = select(func.count()).where(
        Document.entity_type == "asset",
        Document.entity_id == asset_id,
        Document.user_id == user_id,
        Document.is_deleted == False,
    )
    docs_count = (await db.execute(docs_q)).scalar_one()

    return AssetSummary(total_taxes_paid=paid, total_taxes_pending=pending, docs_count=docs_count)
