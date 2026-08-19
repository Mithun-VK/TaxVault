"""add the change-request approval queue

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-30

Members (role "user") may add bills, taxes and insurance policies outright, but
editing or deleting one goes through approval: the attempt is recorded here and
an admin or super admin applies it. See app/services/change_request_service.py.

Purely additive - a new table, no changes to existing ones.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "change_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        # The vault the request acts on (same scoping column as the data).
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # The person who filed it.
        sa.Column(
            "requested_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.String(length=20), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=10), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=12), nullable=False, server_default="pending"
        ),
        sa.Column(
            "reviewed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_change_requests_user_id", "change_requests", ["user_id"])
    op.create_index(
        "ix_change_requests_requested_by_id", "change_requests", ["requested_by_id"]
    )
    # The queue is almost always read as "pending requests for this vault".
    op.create_index(
        "ix_change_requests_user_status", "change_requests", ["user_id", "status"]
    )
    op.create_index(
        "ix_change_requests_entity", "change_requests", ["entity_type", "entity_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_change_requests_entity", table_name="change_requests")
    op.drop_index("ix_change_requests_user_status", table_name="change_requests")
    op.drop_index("ix_change_requests_requested_by_id", table_name="change_requests")
    op.drop_index("ix_change_requests_user_id", table_name="change_requests")
    op.drop_table("change_requests")
