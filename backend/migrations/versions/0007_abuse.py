"""Vorya QR 0.2: abuse handling (blocked domains, public reports, admin-blocked QR codes).

Additive only. `qr_codes.status` gains the value "blocked" (set by an admin; the owner cannot
resume it). Existing rows are untouched.

Revision ID: 0007_abuse
Revises: 0006_stats
"""

import sqlalchemy as sa
from alembic import op

revision = "0007_abuse"
down_revision = "0006_stats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blocked_domains",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("domain", sa.String(253), nullable=False, unique=True),
        sa.Column("reason", sa.String(200), nullable=False, server_default=""),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "abuse_reports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("slug", sa.String(16)),
        sa.Column("qr_code_id", sa.Integer, sa.ForeignKey("qr_codes.id", ondelete="SET NULL")),
        sa.Column("reason", sa.String(16), nullable=False),
        sa.Column("details", sa.Text, nullable=False, server_default=""),
        sa.Column("reporter_email", sa.String(254)),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("resolution", sa.String(24)),
        sa.Column("resolved_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_abuse_reports_status", "abuse_reports", ["status", "created_at"])
    op.add_column("qr_codes", sa.Column("blocked_reason", sa.String(200)))
    # Widen the allowed statuses (existing values stay valid).
    op.drop_constraint("ck_qr_status", "qr_codes", type_="check")
    op.create_check_constraint(
        "ck_qr_status", "qr_codes", "status IN ('active','paused','blocked')"
    )


def downgrade() -> None:
    op.execute("UPDATE qr_codes SET status = 'paused' WHERE status = 'blocked'")
    op.drop_constraint("ck_qr_status", "qr_codes", type_="check")
    op.create_check_constraint("ck_qr_status", "qr_codes", "status IN ('active','paused')")
    op.drop_column("qr_codes", "blocked_reason")
    op.drop_table("abuse_reports")
    op.drop_table("blocked_domains")
