"""Vorya QR 0.1: initial schema and seed (plans, platform settings).

Revision ID: 0001_initial
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)

# Provisional values, editable from the admin area. None = unlimited.
PLANS = [
    {
        "id": "start",
        "name": "Start",
        "description": "Per iniziare con pochi codici QR.",
        "max_qr_static": 10,
        "max_dynamic_qr": 3,
        "position": 1,
    },
    {
        "id": "pro",
        "name": "Pro",
        "description": "Per team e campagne ricorrenti.",
        "max_qr_static": 100,
        "max_dynamic_qr": 25,
        "position": 2,
    },
    {
        "id": "plus",
        "name": "Plus",
        "description": "Per volumi elevati di QR dinamici.",
        "max_qr_static": None,
        "max_dynamic_qr": 250,
        "position": 3,
    },
]


def created():
    return sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False)


def updated():
    return sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(512)),
        sa.Column("role", sa.String(24), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("email_verified_at", TS),
        sa.Column("last_login_at", TS),
        created(),
        updated(),
        sa.Column("deleted_at", TS),
        sa.CheckConstraint(
            "role IN ('super_admin','platform_admin','company_admin')", name="ck_users_role"
        ),
    )
    op.create_table(
        "plans",
        sa.Column("id", sa.String(24), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("max_qr_static", sa.Integer),
        sa.Column("max_dynamic_qr", sa.Integer),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        updated(),
        sa.CheckConstraint("max_qr_static IS NULL OR max_qr_static >= 0", name="ck_plans_static"),
        sa.CheckConstraint(
            "max_dynamic_qr IS NULL OR max_dynamic_qr >= 0", name="ck_plans_dynamic"
        ),
    )
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("owner_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_id", sa.String(24), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("trial_ends_at", TS),
        sa.Column("suspended_at", TS),
        created(),
        updated(),
        sa.UniqueConstraint("owner_user_id", name="uq_workspaces_owner"),
        sa.CheckConstraint("status IN ('active','suspended')", name="ck_workspaces_status"),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        created(),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"])
    op.create_table(
        "password_resets",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("purpose", sa.String(16), nullable=False, server_default="reset"),
        sa.Column("expires_at", TS, nullable=False),
        created(),
    )
    op.create_index("ix_password_resets_user_id", "password_resets", ["user_id"])
    op.create_index("ix_password_resets_expires_at", "password_resets", ["expires_at"])
    op.create_table(
        "auth_rate_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("hits", sa.Integer, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
    )
    op.create_index("ix_auth_rate_limits_expires_at", "auth_rate_limits", ["expires_at"])
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("actor_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("details", sa.JSON, nullable=False),
        created(),
    )
    op.create_index("ix_audit_logs_workspace_id", "audit_logs", ["workspace_id"])
    op.create_table(
        "registrations",
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("workspace_name", sa.String(160), nullable=False),
        sa.Column("terms_accepted_at", TS, nullable=False),
        sa.Column("verified_at", TS),
        created(),
    )
    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(32), primary_key=True),
        sa.Column("data", sa.JSON, nullable=False),
    )
    op.create_table(
        "mail_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("success", sa.Boolean, nullable=False),
        sa.Column("error_code", sa.String(64)),
        created(),
    )
    op.create_table(
        "qr_codes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(8), nullable=False),
        sa.Column("content_type", sa.String(16), nullable=False, server_default="url"),
        sa.Column("target_url", sa.String(2048), nullable=False),
        sa.Column("slug", sa.String(16), unique=True),
        sa.Column("status", sa.String(8), nullable=False, server_default="active"),
        sa.Column("fg_color", sa.String(7), nullable=False, server_default="#091411"),
        sa.Column("bg_color", sa.String(7), nullable=False, server_default="#ffffff"),
        sa.Column("margin", sa.Integer, nullable=False, server_default="4"),
        sa.Column("error_correction", sa.String(1), nullable=False, server_default="M"),
        created(),
        updated(),
        sa.Column("deleted_at", TS),
        sa.CheckConstraint("kind IN ('static','dynamic')", name="ck_qr_kind"),
        sa.CheckConstraint("status IN ('active','paused')", name="ck_qr_status"),
        sa.CheckConstraint("error_correction IN ('L','M','Q','H')", name="ck_qr_ec"),
        sa.CheckConstraint(
            "(kind = 'dynamic') = (slug IS NOT NULL)", name="ck_qr_slug_only_dynamic"
        ),
    )
    op.create_index("ix_qr_codes_workspace_deleted", "qr_codes", ["workspace_id", "deleted_at"])
    op.create_table(
        "scan_events",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "qr_code_id",
            sa.Integer,
            sa.ForeignKey("qr_codes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scanned_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("device_type", sa.String(16), nullable=False),
        sa.Column("os", sa.String(40), nullable=False),
        sa.Column("browser", sa.String(40), nullable=False),
        sa.Column("referrer_host", sa.String(255)),
        sa.Column("is_bot", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_scan_events_qr_time", "scan_events", ["qr_code_id", "scanned_at"])

    plans = sa.table(
        "plans",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("max_qr_static", sa.Integer),
        sa.column("max_dynamic_qr", sa.Integer),
        sa.column("position", sa.Integer),
    )
    op.bulk_insert(plans, PLANS)
    settings = sa.table(
        "platform_settings", sa.column("key", sa.String), sa.column("data", sa.JSON)
    )
    op.bulk_insert(
        settings, [{"key": "general", "data": {"trial_days": 14, "trial_plan_id": "pro"}}]
    )


def downgrade() -> None:
    for table in (
        "scan_events",
        "qr_codes",
        "mail_logs",
        "platform_settings",
        "registrations",
        "audit_logs",
        "auth_rate_limits",
        "password_resets",
        "auth_sessions",
        "workspaces",
        "plans",
        "users",
    ):
        op.drop_table(table)
