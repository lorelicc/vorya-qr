"""Vorya QR 0.5: email reports for the customers of a company, onboarding opt-out, metrics.

- `report_settings` / `report_recipients` / `report_log`: weekly/monthly reports to up to N external
  recipients per company, with double opt-in (the recipient confirms) and an unsubscribe link.
- `users.mail_prefs`: the owner can switch the activation emails off.
- `metrics_snapshots`: one JSON row per day, computed by the worker (never live on heavy queries).

Revision ID: 0018_reports_metrics
Revises: 0017_generator
"""

import sqlalchemy as sa
from alembic import op

revision = "0018_reports_metrics"
down_revision = "0017_generator"
branch_labels = depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "report_settings",
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), primary_key=True),
        sa.Column("weekly", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("monthly", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "report_recipients",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("confirm_hash", sa.String(64), nullable=False),
        sa.Column("unsub_token", sa.String(43), nullable=False, unique=True),
        sa.Column("confirmed_at", TS),
        sa.Column("unsubscribed_at", TS),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("company_id", "email", name="uq_report_recipient"),
    )
    op.create_index("ix_report_recipients_confirm", "report_recipients", ["confirm_hash"])
    op.create_table(
        "report_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("recipient_id", sa.Integer, sa.ForeignKey("report_recipients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(8), nullable=False),
        sa.Column("period_start", TS, nullable=False),
        sa.Column("period_end", TS, nullable=False),
        sa.Column("state", sa.String(8), nullable=False, server_default="pending"),
        sa.Column("due_at", TS, nullable=False),
        sa.Column("sent_at", TS),
        sa.Column("error", sa.String(80)),
        sa.UniqueConstraint("recipient_id", "kind", "period_end", name="uq_report_period"),
    )  # fmt: skip
    op.create_index("ix_report_log_due", "report_log", ["state", "due_at"])
    op.add_column("users", sa.Column("mail_prefs", sa.JSON))
    op.create_table(
        "metrics_snapshots",
        sa.Column("day", sa.Date, primary_key=True),
        sa.Column("data", sa.JSON, nullable=False),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("metrics_snapshots")
    op.drop_column("users", "mail_prefs")
    op.drop_table("report_log")
    op.drop_table("report_recipients")
    op.drop_table("report_settings")
