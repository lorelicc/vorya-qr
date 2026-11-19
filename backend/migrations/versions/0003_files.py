"""Vorya QR 0.2: uploaded files (local volume or S3), owned by a company.

Revision ID: 0003_files
Revises: 0002_companies
"""

import sqlalchemy as sa
from alembic import op

revision = "0003_files"
down_revision = "0002_companies"
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("qr_code_id", sa.Integer, sa.ForeignKey("qr_codes.id", ondelete="SET NULL")),
        sa.Column("kind", sa.String(8), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("mime", sa.String(40), nullable=False),
        sa.Column("original_name", sa.String(200), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("variants", sa.JSON, nullable=False),
        sa.Column("page_count", sa.Integer),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", TS),
        sa.Column("purge_after", TS),
        sa.Column("purged_at", TS),
        sa.CheckConstraint("kind IN ('image','pdf','audio')", name="ck_files_kind"),
    )
    op.create_index("ix_files_workspace_deleted", "files", ["workspace_id", "deleted_at"])
    op.create_index("ix_files_company", "files", ["company_id"])
    op.create_index("ix_files_qr_code_id", "files", ["qr_code_id"])


def downgrade() -> None:
    op.drop_table("files")
