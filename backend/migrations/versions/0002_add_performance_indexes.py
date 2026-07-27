"""add performance indexes

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-17

Composite/partial indexes for the hot query paths: alert scanning, the dashboard
aggregates, the unified payments ledger, and document entity lookups.
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tax obligations — most queried table (alerts + dashboard)
    op.create_index(
        "ix_tax_obligations_user_due_status",
        "tax_obligations",
        ["user_id", "due_date", "status"],
    )
    op.create_index(
        "ix_tax_obligations_asset",
        "tax_obligations",
        ["asset_id"],
        postgresql_where=sa.text("asset_id IS NOT NULL"),
    )

    # Insurance — premium schedule scanning
    op.create_index(
        "ix_insurance_user_next_premium",
        "insurance_policies",
        ["user_id", "next_premium_date"],
    )
    op.create_index(
        "ix_insurance_status",
        "insurance_policies",
        ["user_id", "status"],
    )

    # Recurring bills — active bill scanning
    op.create_index(
        "ix_bills_user_due_active",
        "recurring_bills",
        ["user_id", "next_due_date", "is_active"],
    )

    # Payments — unified ledger queries
    op.create_index(
        "ix_payments_user_entity",
        "payments",
        ["user_id", "entity_type", "entity_id"],
    )
    op.create_index(
        "ix_payments_user_date",
        "payments",
        ["user_id", "payment_date"],
    )

    # Documents — entity lookup + category filter (active rows only)
    op.create_index(
        "ix_documents_user_entity",
        "documents",
        ["user_id", "entity_type", "entity_id"],
        postgresql_where=sa.text("is_deleted = false"),
    )
    op.create_index(
        "ix_documents_user_category",
        "documents",
        ["user_id", "category"],
        postgresql_where=sa.text("is_deleted = false"),
    )

    # Audit logs — recent activity feed
    op.create_index(
        "ix_audit_logs_user_created",
        "audit_logs",
        ["user_id", "created_at"],
    )
    # Note: alert_logs idempotency is already covered by the unique constraint
    # uq_alert_idempotency, so no extra index is created here.


def downgrade() -> None:
    op.drop_index("ix_audit_logs_user_created", table_name="audit_logs")
    op.drop_index("ix_documents_user_category", table_name="documents")
    op.drop_index("ix_documents_user_entity", table_name="documents")
    op.drop_index("ix_payments_user_date", table_name="payments")
    op.drop_index("ix_payments_user_entity", table_name="payments")
    op.drop_index("ix_bills_user_due_active", table_name="recurring_bills")
    op.drop_index("ix_insurance_status", table_name="insurance_policies")
    op.drop_index("ix_insurance_user_next_premium", table_name="insurance_policies")
    op.drop_index("ix_tax_obligations_asset", table_name="tax_obligations")
    op.drop_index("ix_tax_obligations_user_due_status", table_name="tax_obligations")
