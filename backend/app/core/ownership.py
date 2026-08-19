from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError


def _get_model_for_entity(entity_type: str):  # type: ignore[no-untyped-def]
    from app.models.asset import Asset
    from app.models.insurance import InsurancePolicy
    from app.models.recurring_bill import RecurringBill
    from app.models.tax_obligation import TaxObligation

    model_map = {
        "tax": TaxObligation,
        "insurance": InsurancePolicy,
        "bill": RecurringBill,
        "asset": Asset,
    }
    model = model_map.get(entity_type)
    if model is None:
        raise NotFoundError(f"Unknown entity type: {entity_type}")
    return model


async def verify_entity_ownership(
    db: AsyncSession,
    entity_type: str,
    entity_id: UUID | str,
    user_id: UUID | str,
) -> None:
    """Verify the entity exists AND belongs to this user.

    Always raises NotFoundError (404) on failure - never 403 - so the response
    does not reveal whether a resource owned by someone else exists.
    """
    model = _get_model_for_entity(entity_type)
    result = await db.execute(
        select(model.id).where(model.id == entity_id, model.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise NotFoundError(f"{entity_type.capitalize()} not found or access denied.")
