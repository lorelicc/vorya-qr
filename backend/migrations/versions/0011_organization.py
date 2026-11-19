"""Vorya QR 0.3: folders, tags and the folder of a link.

Folders belong to a company and nest one level (a folder and its sub-folders). Deleting a folder
never deletes links: they move to its parent. Tags are per company with a colour.

Revision ID: 0011_organization
Revises: 0010_versions
"""

import sqlalchemy as sa
from alembic import op

revision = "0011_organization"
down_revision = "0010_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("folders.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_folders_company", "folders", ["company_id", "parent_id"])
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#087f5b"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "uq_tags_company_name", "tags", ["company_id", sa.text("lower(name)")], unique=True
    )
    op.create_table(
        "link_tags",
        sa.Column(
            "qr_code_id",
            sa.Integer,
            sa.ForeignKey("qr_codes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id", sa.Integer, sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    op.create_index("ix_link_tags_tag", "link_tags", ["tag_id"])
    op.add_column(
        "qr_codes",
        sa.Column("folder_id", sa.Integer, sa.ForeignKey("folders.id", ondelete="SET NULL")),
    )
    op.create_index("ix_qr_codes_folder_id", "qr_codes", ["folder_id"])


def downgrade() -> None:
    op.drop_column("qr_codes", "folder_id")
    op.drop_table("link_tags")
    op.drop_table("tags")
    op.drop_table("folders")
