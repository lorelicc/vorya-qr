"""Vorya QR 0.6: clients managed by the admin (invited, archived, purged).

- `workspaces.deleted_at / purge_after / deleted_by`: a deleted client is ARCHIVED for 30 days (it can
  be restored), then the worker purges its personal data.
- `registrations.invite`: what the admin chose when inviting a client (plan, trial days).

Additive: nothing existing changes.

Revision ID: 0019_client_archive
Revises: 0018_reports_metrics
"""

import sqlalchemy as sa
from alembic import op

revision = "0019_client_archive"
down_revision = "0018_reports_metrics"
branch_labels = depends_on = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("workspaces", sa.Column("deleted_at", TS))
    op.add_column("workspaces", sa.Column("purge_after", TS))
    op.add_column(
        "workspaces",
        sa.Column("deleted_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
    )
    op.create_index("ix_workspaces_deleted", "workspaces", ["deleted_at"])
    op.drop_constraint("ck_workspaces_status", "workspaces", type_="check")
    op.create_check_constraint(
        "ck_workspaces_status",
        "workspaces",
        "status IN ('active','suspended','archived','purged')",
    )
    op.add_column("registrations", sa.Column("invite", sa.JSON))
    # A client invited by an admin has not accepted the terms yet (no pretend consent).
    op.alter_column("registrations", "terms_accepted_at", existing_type=TS, nullable=True)


def downgrade() -> None:
    op.execute("UPDATE workspaces SET status = 'suspended' WHERE status IN ('archived','purged')")
    op.drop_constraint("ck_workspaces_status", "workspaces", type_="check")
    op.create_check_constraint("ck_workspaces_status", "workspaces", "status IN ('active','suspended')")
    op.execute("UPDATE registrations SET terms_accepted_at = created_at WHERE terms_accepted_at IS NULL")
    op.alter_column("registrations", "terms_accepted_at", existing_type=TS, nullable=False)
    op.drop_column("registrations", "invite")
    op.drop_index("ix_workspaces_deleted", table_name="workspaces")
    op.drop_column("workspaces", "deleted_by")
    op.drop_column("workspaces", "purge_after")
    op.drop_column("workspaces", "deleted_at")
