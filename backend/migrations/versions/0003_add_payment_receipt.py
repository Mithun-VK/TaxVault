"""add payment receipt_document_id

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-03

Adds a soft reference from a payment to the document holding its receipt, so a
receipt uploaded alongside a payment is linked to the payment row itself rather
than only discoverable via the payable entity's document attachments.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("receipt_document_id", UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payments", "receipt_document_id")
