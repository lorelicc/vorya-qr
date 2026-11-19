"""Vorya QR 0.4: plan grants (gifts) from the admin panel.

Revision ID: 0014_grants
Revises: 0013_billing
"""

import sqlalchemy as sa
from alembic import op

revision = "0014_grants"
down_revision = "0013_billing"
branch_labels = depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("workspaces", sa.Column("grant_until", TS))
    op.create_table(
        "plan_grants",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("plan_id", sa.String(24), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("months", sa.Integer, nullable=False),
        sa.Column("starts_at", TS, nullable=False),
        sa.Column("ends_at", TS, nullable=False),
        sa.Column("note", sa.String(300), nullable=False, server_default=""),
        sa.Column("previous_plan_id", sa.String(24)),
        sa.Column("granted_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("revoked_at", TS),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_plan_grants_workspace", "plan_grants", ["workspace_id", "created_at"])


def downgrade() -> None:
    op.drop_table("plan_grants")
    op.drop_column("workspaces", "grant_until")
