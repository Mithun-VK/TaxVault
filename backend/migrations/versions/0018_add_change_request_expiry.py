"""expire change requests nobody reviews in time

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-31

A member's edit or delete now carries a deadline (CHANGE_REQUEST_TTL_MINUTES,
15 by default). Past it the request lapses to status "expired" rather than
sitting in the queue where an admin could approve a stale change long after the
record has moved on. The sweep runs whenever the queue is read or reviewed -
see change_request_service._expire_stale.

Rows already in flight get a deadline measured from when they were filed, so
anything older than the TTL lapses on the next read.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "change_requests",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_change_requests_expires_at", "change_requests", ["expires_at"])
    # Backfill pending rows from their creation time; reviewed rows keep NULL
    # because the deadline no longer applies to them.
    op.execute(
        """
        UPDATE change_requests
        SET expires_at = created_at + INTERVAL '15 minutes'
        WHERE status = 'pending'
        """
    )


def downgrade() -> None:
    # Anything already lapsed goes back to pending - the column that justified
    # the status is going away.
    op.execute("UPDATE change_requests SET status = 'pending' WHERE status = 'expired'")
    op.drop_index("ix_change_requests_expires_at", table_name="change_requests")
    op.drop_column("change_requests", "expires_at")
