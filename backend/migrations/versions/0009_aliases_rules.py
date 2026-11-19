"""Vorya QR 0.3: custom back-halves (aliases) and UTM templates.

An alias never replaces the slug: printed QR codes keep their /r/{slug}. Removed aliases stay
reserved 90 days for the same account (row kept with removed_at) before anyone can reuse them.

Revision ID: 0009_aliases_rules
Revises: 0008_links
"""

import sqlalchemy as sa
from alembic import op

revision = "0009_aliases_rules"
down_revision = "0008_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "link_aliases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "qr_code_id",
            sa.Integer,
            sa.ForeignKey("qr_codes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("alias", sa.String(50), nullable=False, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_link_aliases_qr", "link_aliases", ["qr_code_id"])
    op.create_table(
        "utm_templates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False, index=True
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("source", sa.String(100), nullable=False, server_default=""),
        sa.Column("medium", sa.String(100), nullable=False, server_default=""),
        sa.Column("campaign", sa.String(100), nullable=False, server_default=""),
        sa.Column("term", sa.String(100), nullable=False, server_default=""),
        sa.Column("content", sa.String(100), nullable=False, server_default=""),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("utm_templates")
    op.drop_table("link_aliases")
