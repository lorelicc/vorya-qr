"""Vorya QR 0.2: companies, plan features and company transfers.

Additive only. Every 0.1 workspace gets a default company (named after the workspace) and
all its QR codes move there. Slugs, destinations and statuses are untouched, so every
printed QR keeps working.

Revision ID: 0002_companies
Revises: 0001_initial
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_companies"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)
START_TYPES = [
    "website",
    "vcard",
    "link_in_bio",
    "wifi",
    "text",
    "email",
    "sms",
    "phone",
    "whatsapp",
]
ALL_TYPES = [
    "website", "vcard", "pdf", "music", "link_in_bio", "gallery", "business",
    "wifi", "text", "email", "sms", "phone", "whatsapp",
]  # fmt: skip
PLAN_SEED = {
    "start": (1, {"allowed_types": START_TYPES, "storage_mb": 100, "max_file_mb": 10,
                  "remove_branding": False, "stats_retention_days": 90, "max_style_presets": 3}),
    "pro": (3, {"allowed_types": ALL_TYPES, "storage_mb": 1024, "max_file_mb": 25,
                "remove_branding": True, "stats_retention_days": 365, "max_style_presets": 20}),
    "plus": (10, {"allowed_types": ALL_TYPES, "storage_mb": 5120, "max_file_mb": 50,
                  "remove_branding": True, "stats_retention_days": None,
                  "max_style_presets": None}),
}  # fmt: skip


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("logo_file_id", sa.String(36)),
        sa.Column("primary_color", sa.String(7), nullable=False, server_default="#087f5b"),
        sa.Column("secondary_color", sa.String(7), nullable=False, server_default="#00e99a"),
        sa.Column("sector", sa.String(80)),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", TS),
        sa.Column("purge_after", TS),
        sa.CheckConstraint("status IN ('active','purged')", name="ck_companies_status"),
    )
    op.create_index("ix_companies_workspace_deleted", "companies", ["workspace_id", "deleted_at"])

    # Default company per workspace, then attach every existing QR code to it.
    op.execute(
        "INSERT INTO companies (workspace_id, name, created_at, updated_at) "
        "SELECT id, left(name, 120), created_at, now() FROM workspaces ORDER BY id"
    )
    op.add_column("qr_codes", sa.Column("company_id", sa.Integer, nullable=True))
    op.execute(
        "UPDATE qr_codes q SET company_id = c.id FROM companies c "
        "WHERE c.workspace_id = q.workspace_id"
    )
    op.alter_column("qr_codes", "company_id", nullable=False)
    op.create_foreign_key("fk_qr_codes_company", "qr_codes", "companies", ["company_id"], ["id"])
    op.create_index("ix_qr_codes_company_id", "qr_codes", ["company_id"])

    op.add_column("users", sa.Column("last_company_id", sa.Integer))
    op.create_foreign_key(
        "fk_users_last_company", "users", "companies", ["last_company_id"], ["id"],
        ondelete="SET NULL",
    )  # fmt: skip
    op.add_column("audit_logs", sa.Column("company_id", sa.Integer))
    op.create_foreign_key(
        "fk_audit_logs_company", "audit_logs", "companies", ["company_id"], ["id"],
        ondelete="SET NULL",
    )  # fmt: skip
    op.create_index("ix_audit_logs_company_id", "audit_logs", ["company_id"])

    op.add_column("plans", sa.Column("max_companies", sa.Integer))
    op.add_column("plans", sa.Column("features", sa.JSON, nullable=False, server_default="{}"))
    plans = sa.table(
        "plans",
        sa.column("id", sa.String),
        sa.column("max_companies", sa.Integer),
        sa.column("features", sa.JSON),
    )
    for plan_id, (max_companies, features) in PLAN_SEED.items():
        op.execute(
            plans.update()
            .where(plans.c.id == plan_id)
            .values(max_companies=max_companies, features=features)
        )

    op.create_table(
        "company_transfers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("from_workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("to_workspace_id", sa.Integer, sa.ForeignKey("workspaces.id"), nullable=False),
        sa.Column("to_email", sa.String(254), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("failure_reason", sa.String(300)),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("decided_at", TS),
        sa.CheckConstraint(
            "status IN ('pending','accepted','declined','cancelled','expired')",
            name="ck_company_transfers_status",
        ),
    )
    op.create_index(
        "uq_company_transfers_pending",
        "company_transfers",
        ["company_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )
    op.create_index("ix_company_transfers_to", "company_transfers", ["to_workspace_id", "status"])


def downgrade() -> None:
    op.drop_table("company_transfers")
    op.drop_column("plans", "features")
    op.drop_column("plans", "max_companies")
    op.drop_index("ix_audit_logs_company_id", "audit_logs")
    op.drop_constraint("fk_audit_logs_company", "audit_logs", type_="foreignkey")
    op.drop_column("audit_logs", "company_id")
    op.drop_constraint("fk_users_last_company", "users", type_="foreignkey")
    op.drop_column("users", "last_company_id")
    op.drop_index("ix_qr_codes_company_id", "qr_codes")
    op.drop_constraint("fk_qr_codes_company", "qr_codes", type_="foreignkey")
    op.drop_column("qr_codes", "company_id")
    op.drop_table("companies")
