"""Vorya QR 0.2: saved style presets per company.

Revision ID: 0005_style_presets
Revises: 0004_qr_types_pages
"""

import sqlalchemy as sa
from alembic import op

revision = "0005_style_presets"
down_revision = "0004_qr_types_pages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "style_presets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("design", sa.JSON, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_style_presets_company_id", "style_presets", ["company_id"])


def downgrade() -> None:
    op.drop_table("style_presets")
