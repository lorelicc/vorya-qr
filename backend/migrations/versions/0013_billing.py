"""Vorya QR 0.3: Stripe billing (additive; existing accounts keep working).

Prices are rows (admin-managed, linked to Stripe price IDs), never constants. Accounts that were
already expired under 0.2 get a fresh redirect window instead of being switched off at once.

Revision ID: 0013_billing
Revises: 0012_imports
"""

import sqlalchemy as sa
from alembic import op

revision = "0013_billing"
down_revision = "0012_imports"
branch_labels = depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("workspaces", sa.Column("billing_state", sa.String(12)))
    op.add_column("workspaces", sa.Column("grace_until", TS))
    op.add_column("workspaces", sa.Column("redirects_until", TS))
    op.create_table(
        "billing_accounts",
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), primary_key=True),
        sa.Column("customer_id", sa.String(100), unique=True),
        sa.Column("subscription_id", sa.String(100), unique=True),
        sa.Column("stripe_status", sa.String(24)),
        sa.Column("plan_id", sa.String(24)),
        sa.Column("cycle", sa.String(8)),
        sa.Column("price_id", sa.String(100)),
        sa.Column("period_end", TS),
        sa.Column("cancel_at_period_end", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("past_due_since", TS),
        sa.Column("checkout_id", sa.String(100)),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "billing_prices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("plan_id", sa.String(24), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("cycle", sa.String(8), nullable=False),
        sa.Column("stripe_price_id", sa.String(100), nullable=False, unique=True),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="eur"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "uq_billing_prices_active",
        "billing_prices",
        ["plan_id", "cycle"],
        unique=True,
        postgresql_where=sa.text("active"),
    )
    op.create_table(
        "billing_profiles",
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), primary_key=True),
        sa.Column("legal_name", sa.String(160), nullable=False),
        sa.Column("vat", sa.String(20), nullable=False, server_default=""),
        sa.Column("tax_code", sa.String(20), nullable=False, server_default=""),
        sa.Column("address", sa.String(200), nullable=False),
        sa.Column("zip", sa.String(12), nullable=False),
        sa.Column("city", sa.String(80), nullable=False),
        sa.Column("province", sa.String(3), nullable=False, server_default=""),
        sa.Column("country", sa.String(2), nullable=False, server_default="IT"),
        sa.Column("sdi_code", sa.String(7), nullable=False, server_default=""),
        sa.Column("pec", sa.String(160), nullable=False, server_default=""),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "billing_events",
        sa.Column("id", sa.String(100), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("state", sa.String(12), nullable=False, server_default="done"),
        sa.Column("error", sa.String(200)),
        sa.Column("received_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "billing_payments",
        sa.Column("invoice_id", sa.String(100), primary_key=True),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("plan_id", sa.String(24)),
        sa.Column("document_url", sa.String(2048)),
        sa.Column("profile", sa.JSON),
        sa.Column("paid_at", TS),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_billing_payments_workspace", "billing_payments", ["workspace_id"])
    op.create_index("ix_billing_payments_paid_at", "billing_payments", ["paid_at"])
    op.create_table(
        "billing_mail",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("event_key", sa.String(160), nullable=False, unique=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("state", sa.String(8), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("due_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", TS),
    )
    op.create_index("ix_billing_mail_pending", "billing_mail", ["state", "due_at"])
    # Not retroactive: workspaces already expired under 0.2 keep their redirects for 30 more days.
    op.execute(
        "UPDATE workspaces SET redirects_until = now() + interval '30 days' "
        "WHERE trial_ends_at IS NOT NULL AND trial_ends_at <= now()"
    )
    op.execute(
        "INSERT INTO platform_settings (key, data) VALUES "
        "('billing', '{\"grace_days\": 7, \"redirect_days\": 30}') ON CONFLICT (key) DO NOTHING"
    )


def downgrade() -> None:
    for table in (
        "billing_mail",
        "billing_payments",
        "billing_events",
        "billing_profiles",
        "billing_prices",
        "billing_accounts",
    ):
        op.drop_table(table)
    for column in ("redirects_until", "grace_until", "billing_state"):
        op.drop_column("workspaces", column)
