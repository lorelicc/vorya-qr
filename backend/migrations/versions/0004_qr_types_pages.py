"""Vorya QR 0.2: QR types, hosted pages, design JSON.

0.1 QR codes become type "website": dynamic ones keep destination "redirect" with the same
target_url, static ones get static_data {"url": target_url}. Nothing else changes.

Revision ID: 0004_qr_types_pages
Revises: 0003_files
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_qr_types_pages"
down_revision = "0003_files"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "qr_codes", sa.Column("qr_type", sa.String(16), nullable=False, server_default="website")
    )
    op.add_column(
        "qr_codes",
        sa.Column("destination", sa.String(8), nullable=False, server_default="redirect"),
    )
    op.add_column("qr_codes", sa.Column("static_data", sa.JSON))
    op.add_column("qr_codes", sa.Column("design", sa.JSON))
    op.execute(
        "UPDATE qr_codes SET static_data = json_build_object('url', target_url) "
        "WHERE kind = 'static'"
    )
    op.create_check_constraint(
        "ck_qr_destination", "qr_codes", "destination IN ('redirect','page')"
    )
    op.create_table(
        "qr_pages",
        sa.Column(
            "qr_code_id",
            sa.Integer,
            sa.ForeignKey("qr_codes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("schema_version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("template", sa.String(16), nullable=False),
        sa.Column("document", sa.JSON, nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("qr_pages")
    op.drop_constraint("ck_qr_destination", "qr_codes", type_="check")
    for column in ("design", "static_data", "destination", "qr_type"):
        op.drop_column("qr_codes", column)
