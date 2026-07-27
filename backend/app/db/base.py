from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models here so Alembic sees them
from app.models import (  # noqa: F401, E402
    alert_config,
    alert_log,
    asset,
    audit_log,
    document,
    individual,
    insurance,
    payment,
    recurring_bill,
    tax_obligation,
    user,
)
