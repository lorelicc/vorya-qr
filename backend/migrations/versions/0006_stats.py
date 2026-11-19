"""Vorya QR 0.2: richer statistics (approximate geo, daily unique estimate, page clicks).

Only additive changes: new nullable columns on scan_events and two new tables. The IP address
is never stored; `visitor_hash` is a truncated hash keyed by a salt that is destroyed the next day.

Revision ID: 0006_stats
Revises: 0005_style_presets
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_stats"
down_revision = "0005_style_presets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scan_events", sa.Column("country_code", sa.String(2)))
    op.add_column("scan_events", sa.Column("city", sa.String(80)))
    op.add_column("scan_events", sa.Column("visitor_hash", sa.String(16)))
    op.create_table(
        "daily_salts",
        sa.Column("day", sa.Date, primary_key=True),
        sa.Column("salt", sa.LargeBinary(32), nullable=False),
    )
    op.create_table(
        "page_events",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "qr_code_id",
            sa.Integer,
            sa.ForeignKey("qr_codes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("device_type", sa.String(16), nullable=False),
    )
    op.create_index("ix_page_events_qr_time", "page_events", ["qr_code_id", "created_at"])


def downgrade() -> None:
    op.drop_table("page_events")
    op.drop_table("daily_salts")
    op.drop_column("scan_events", "visitor_hash")
    op.drop_column("scan_events", "city")
    op.drop_column("scan_events", "country_code")
