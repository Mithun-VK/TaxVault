"""Initial schema - all 11 tables

Revision ID: 0001
Revises:
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String()),
        sa.Column("phone_number", sa.String()),
        sa.Column("device_tokens", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset_type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String()),
        sa.Column("acquisition_date", sa.Date()),
        sa.Column("acquisition_cost", sa.Numeric(14, 2)),
        sa.Column("current_value", sa.Numeric(14, 2)),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("asset_metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("notes", sa.String()),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "insurance_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id")),
        sa.Column("policy_number", sa.String(), nullable=False),
        sa.Column("provider_name", sa.String(), nullable=False),
        sa.Column("insurance_type", sa.String(), nullable=False),
        sa.Column("sum_insured", sa.Numeric(14, 2)),
        sa.Column("premium_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("premium_frequency", sa.String(), nullable=False),
        sa.Column("next_premium_date", sa.Date()),
        sa.Column("policy_start_date", sa.Date()),
        sa.Column("policy_end_date", sa.Date()),
        sa.Column("maturity_date", sa.Date()),
        sa.Column("nominee_name", sa.String()),
        sa.Column("nominee_relation", sa.String()),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("notes", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "tax_obligations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id")),
        sa.Column("tax_type", sa.String(), nullable=False),
        sa.Column("jurisdiction", sa.String()),
        sa.Column("assessment_year", sa.String()),
        sa.Column("description", sa.String()),
        sa.Column("total_amount", sa.Numeric(12, 2)),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("recurrence_rule", sa.String()),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("notes", sa.String()),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "recurring_bills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("bill_type", sa.String(), nullable=False),
        sa.Column("provider_name", sa.String()),
        sa.Column("account_number", sa.String()),
        sa.Column("billing_cycle", sa.String(), nullable=False),
        sa.Column("average_amount", sa.Numeric(10, 2)),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_paid", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("payment_method", sa.String()),
        sa.Column("reference_number", sa.String()),
        sa.Column("notes", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("entity_type", sa.String()),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("category", sa.String()),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("financial_year", sa.String()),
        sa.Column("tags", sa.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("file_name", sa.String()),
        sa.Column("file_size_kb", sa.Integer()),
        sa.Column("mime_type", sa.String()),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
    )

    op.create_table(
        "alert_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("days_before", sa.ARRAY(sa.Integer()), nullable=False, server_default="{30,15,7,3,1}"),
        sa.Column("channels", sa.ARRAY(sa.String()), nullable=False, server_default="{email,push}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "alert_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("days_before", sa.Integer()),
        sa.Column("sent_date", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.String()),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("entity_type", "entity_id", "channel", "days_before", "sent_date", name="uq_alert_idempotency"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("changes", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("alert_logs")
    op.drop_table("alert_configs")
    op.drop_table("documents")
    op.drop_table("payments")
    op.drop_table("recurring_bills")
    op.drop_table("tax_obligations")
    op.drop_table("insurance_policies")
    op.drop_table("assets")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
