"""Vorya QR 0.3: content version history of dynamic links.

Every content save creates a version (type, content, linked files, author). Existing dynamic
links get version 1 from their current content, so history starts populated and nothing changes
for the redirect: the live content is still read from qr_codes / qr_pages.

Revision ID: 0010_versions
Revises: 0009_aliases_rules
"""

import json
import re

import sqlalchemy as sa
from alembic import op

revision = "0010_versions"
down_revision = "0009_aliases_rules"
branch_labels = None
depends_on = None

FILE_ID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")


def upgrade() -> None:
    op.create_table(
        "link_versions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "qr_code_id",
            sa.Integer,
            sa.ForeignKey("qr_codes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("number", sa.Integer, nullable=False),
        sa.Column("qr_type", sa.String(16), nullable=False),
        sa.Column("destination", sa.String(8), nullable=False),
        sa.Column("target_url", sa.String(2048), nullable=False, server_default=""),
        sa.Column("page", sa.JSON),
        sa.Column("file_ids", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("change", sa.String(12), nullable=False, server_default="content"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("qr_code_id", "number", name="uq_link_versions_number"),
    )
    op.create_index("ix_link_versions_qr_created", "link_versions", ["qr_code_id", "created_at"])
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO link_versions (qr_code_id, number, qr_type, destination, target_url, page, "
            "change, created_at) "
            "SELECT q.id, 1, q.qr_type, q.destination, q.target_url, p.document, 'created', q.created_at "
            "FROM qr_codes q LEFT JOIN qr_pages p ON p.qr_code_id = q.id WHERE q.kind = 'dynamic'"
        )
    )
    rows = conn.execute(
        sa.text("SELECT id, page::text FROM link_versions WHERE page IS NOT NULL")
    ).all()
    for version_id, page in rows:
        ids = sorted(set(FILE_ID.findall(page or "")))
        if ids:
            conn.execute(
                sa.text("UPDATE link_versions SET file_ids = CAST(:ids AS json) WHERE id = :id"),
                {"ids": json.dumps(ids), "id": version_id},
            )


def downgrade() -> None:
    op.drop_table("link_versions")
