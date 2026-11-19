"""Vorya QR 0.3: bulk creation from CSV (import jobs).

The links of an import are created atomically at confirmation (quota checked for the whole
batch under the workspace lock); the worker then renders the QR files into a ZIP and reports its
progress through `processed`.

Revision ID: 0012_imports
Revises: 0011_organization
"""

import sqlalchemy as sa
from alembic import op

revision = "0012_imports"
down_revision = "0011_organization"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        # validated | invalid | queued | running | done | failed
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("fmt", sa.String(4), nullable=False, server_default="png"),
        sa.Column("size", sa.Integer, nullable=False, server_default="1024"),
        sa.Column("total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("processed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rows", sa.JSON),
        sa.Column("preview", sa.JSON),
        sa.Column("errors", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("created_ids", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("result_key", sa.String(80)),
        sa.Column("error", sa.String(200)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_import_jobs_company", "import_jobs", ["company_id", "created_at"])
    op.create_index("ix_import_jobs_status", "import_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("import_jobs")
