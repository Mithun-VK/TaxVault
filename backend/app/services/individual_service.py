import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DuplicateError, NotFoundError
from app.models.asset import Asset
from app.models.individual import Individual
from app.schemas.individual import IndividualCreate, IndividualUpdate
from app.services import document_service

# Warn when a passport / visa expires within this many days.
EXPIRY_WARNING_DAYS = 90


async def _get_or_404(db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID) -> Individual:
    result = await db.execute(
        select(Individual).where(
            Individual.id == id,
            Individual.user_id == user_id,
            Individual.is_archived == False,  # noqa: E712
        )
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundError("Individual not found")
    return obj


async def _asset_count(db: AsyncSession, individual_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Asset.id)).where(
            Asset.individual_id == individual_id,
            Asset.is_archived == False,  # noqa: E712
        )
    )
    return result.scalar() or 0


def _parse_iso(value) -> date | None:
    """Coerce a stored visa date (ISO string or date) to a date, or None."""
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _enrich(individual: Individual, asset_count: int) -> dict:
    """Build the response dict: row fields + presigned URLs + computed flags."""
    today = date.today()
    warn_date = today + timedelta(days=EXPIRY_WARNING_DAYS)

    visas = individual.visas or []
    active_visas = [
        v
        for v in visas
        if not v.get("expiry_date") or (_parse_iso(v.get("expiry_date")) or today) >= today
    ]

    has_expiring = bool(
        individual.passport_expiry and individual.passport_expiry <= warn_date
    )
    for v in active_visas:
        exp = _parse_iso(v.get("expiry_date"))
        if exp and exp <= warn_date:
            has_expiring = True

    return {
        "id": individual.id,
        "user_id": individual.user_id,
        "full_name": individual.full_name,
        "date_of_birth": individual.date_of_birth,
        "relationship_to_owner": individual.relationship_to_owner,
        "phone_number": individual.phone_number,
        "email": individual.email,
        "address": individual.address,
        "photo_key": individual.photo_key,
        "photo_url": document_service.presign_get_for_key(individual.photo_key),
        "aadhaar_number": individual.aadhaar_number,
        "aadhaar_photo_url": document_service.presign_get_for_key(individual.aadhaar_photo_key),
        "pan_number": individual.pan_number,
        "pan_photo_url": document_service.presign_get_for_key(individual.pan_photo_key),
        "passport_number": individual.passport_number,
        "passport_expiry": individual.passport_expiry,
        "passport_photo_url": document_service.presign_get_for_key(individual.passport_photo_key),
        "visas": visas,
        "notes": individual.notes,
        "is_archived": individual.is_archived,
        "created_at": individual.created_at,
        "asset_count": asset_count,
        "active_visa_count": len(active_visas),
        "has_expiring_docs": has_expiring,
    }


async def list_individuals(
    db: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> tuple[list[dict], int]:
    result = await db.execute(
        select(Individual)
        .where(Individual.user_id == user_id, Individual.is_archived == False)  # noqa: E712
        .order_by(Individual.full_name)
        .offset(skip)
        .limit(limit)
    )
    individuals = result.scalars().all()

    total_result = await db.execute(
        select(func.count(Individual.id)).where(
            Individual.user_id == user_id,
            Individual.is_archived == False,  # noqa: E712
        )
    )
    total = total_result.scalar() or 0

    enriched = [_enrich(ind, await _asset_count(db, ind.id)) for ind in individuals]
    return enriched, total


async def get_individual(db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID) -> dict:
    ind = await _get_or_404(db, id, user_id)
    return _enrich(ind, await _asset_count(db, ind.id))


async def create_individual(
    db: AsyncSession, user_id: uuid.UUID, data: IndividualCreate
) -> dict:
    if data.pan_number:
        existing = await db.execute(
            select(Individual).where(
                Individual.user_id == user_id,
                Individual.pan_number == data.pan_number,
                Individual.is_archived == False,  # noqa: E712
            )
        )
        if existing.scalar_one_or_none():
            raise DuplicateError(
                f"An individual with PAN {data.pan_number} already exists"
            )

    payload = data.model_dump(exclude={"visas"})
    ind = Individual(
        user_id=user_id,
        visas=[v.model_dump(mode="json") for v in data.visas],
        **payload,
    )
    db.add(ind)
    await db.commit()
    await db.refresh(ind)
    return _enrich(ind, 0)


async def update_individual(
    db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID, data: IndividualUpdate
) -> dict:
    ind = await _get_or_404(db, id, user_id)
    update_data = data.model_dump(exclude_unset=True)

    if data.pan_number and data.pan_number != ind.pan_number:
        existing = await db.execute(
            select(Individual).where(
                Individual.user_id == user_id,
                Individual.pan_number == data.pan_number,
                Individual.id != id,
                Individual.is_archived == False,  # noqa: E712
            )
        )
        if existing.scalar_one_or_none():
            raise DuplicateError(
                f"An individual with PAN {data.pan_number} already exists"
            )

    if "visas" in update_data and update_data["visas"] is not None:
        update_data["visas"] = [
            v.model_dump(mode="json") if hasattr(v, "model_dump") else v
            for v in data.visas
        ]

    for key, value in update_data.items():
        setattr(ind, key, value)

    await db.commit()
    await db.refresh(ind)
    return _enrich(ind, await _asset_count(db, ind.id))


async def archive_individual(db: AsyncSession, id: uuid.UUID, user_id: uuid.UUID) -> dict:
    ind = await _get_or_404(db, id, user_id)
    ind.is_archived = True
    await db.commit()
    return {"message": f"{ind.full_name} archived successfully"}


async def get_individual_assets(
    db: AsyncSession, individual_id: uuid.UUID, user_id: uuid.UUID
) -> list[Asset]:
    await _get_or_404(db, individual_id, user_id)
    result = await db.execute(
        select(Asset)
        .where(
            Asset.individual_id == individual_id,
            Asset.is_archived == False,  # noqa: E712
        )
        .order_by(Asset.asset_type, Asset.name)
    )
    return list(result.scalars().all())
