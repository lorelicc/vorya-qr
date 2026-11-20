"""Vorya QR 0.5: the five plans (Free, Start, Plus, Pro, Agency) and the "QR always on" rule.

- `max_dynamic_qr` now means dynamic codes PER COMPANY.
- Old `pro` (3 companies) becomes `plus`, old `plus` (10 companies) becomes `pro`: every
  workspace, price link, gift and payment record is moved with it, so nobody changes entitlements.
- The Free plan is the landing place of an ended trial / cancelled subscription: nothing is
  switched off any more. Workspaces blocked by 0.3/0.4 rules are simply on Free from now on.
- `redirects_until` windows are cleared: every redirect works again.

Revision ID: 0015_plans
Revises: 0014_grants
"""

import json

import sqlalchemy as sa
from alembic import op

revision = "0015_plans"
down_revision = "0014_grants"
branch_labels = depends_on = None

BASE_TYPES = ["website", "wifi", "text", "email", "sms", "phone", "whatsapp"]
ALL_PAGES = ["vcard", "pdf", "music", "link_in_bio", "gallery", "business"]


def features(**over):
    base = dict(
        allowed_types=BASE_TYPES + ["vcard", "link_in_bio"], storage_mb=50, max_file_mb=5,
        remove_branding=False, stats_retention_days=30, max_style_presets=1,
        custom_back_half=False, max_aliases_per_link=0, link_rules=False, utm_templates=False,
        max_bulk_rows=0, version_history=False, menu_type=False,
        report_frequencies=[], report_recipients=0, report_pdf=False,
    )  # fmt: skip
    base.update(over)
    return base


# id: (name, description, position, max_companies, max_dynamic_qr (per company), max_static, features)
PLANS = {
    "free": ("Free", "Per provare, per sempre gratis e senza pubblicità.", 0, 1, 2, 10, features()),
    "start": ("Start", "Per un'attività che vuole iniziare bene.", 1, 1, 10, None, features(
        allowed_types=BASE_TYPES + ALL_PAGES, menu_type=True, storage_mb=500, max_file_mb=20,
        stats_retention_days=90, max_style_presets=3, custom_back_half=True,
        max_aliases_per_link=1, version_history=True, max_bulk_rows=50,
        report_frequencies=["monthly"], report_recipients=1)),
    "plus": ("Plus", "Per più attività e campagne ricorrenti.", 2, 3, 25, None, features(
        allowed_types=BASE_TYPES + ALL_PAGES, menu_type=True, storage_mb=2048, max_file_mb=50,
        stats_retention_days=365, max_style_presets=20, custom_back_half=True,
        max_aliases_per_link=3, link_rules=True, utm_templates=True, version_history=True,
        max_bulk_rows=200, report_frequencies=["weekly", "monthly"], report_recipients=3)),
    "pro": ("Pro", "Per chi gestisce molti clienti e volumi.", 3, 10, 35, None, features(
        allowed_types=BASE_TYPES + ALL_PAGES, menu_type=True, storage_mb=10240, max_file_mb=100,
        stats_retention_days=730, max_style_presets=100, remove_branding=True,
        custom_back_half=True, max_aliases_per_link=10, link_rules=True, utm_templates=True,
        version_history=True, max_bulk_rows=1000, report_frequencies=["weekly", "monthly"],
        report_recipients=5, report_pdf=True)),
    "agency": ("Agency", "Aziende e codici senza limiti, per le agenzie.", 4, None, None, None, features(
        allowed_types=BASE_TYPES + ALL_PAGES, menu_type=True, storage_mb=51200, max_file_mb=200,
        stats_retention_days=None, max_style_presets=None, remove_branding=True,
        custom_back_half=True, max_aliases_per_link=None, link_rules=True, utm_templates=True,
        version_history=True, max_bulk_rows=5000, report_frequencies=["weekly", "monthly"],
        report_recipients=5, report_pdf=True)),
}  # fmt: skip

REFS = [  # (table, column)
    ("workspaces", "plan_id"),
    ("billing_prices", "plan_id"),
    ("billing_accounts", "plan_id"),
    ("billing_payments", "plan_id"),
    ("plan_grants", "plan_id"),
    ("plan_grants", "previous_plan_id"),
]


def repoint(conn, old: str, new: str) -> None:
    for table, column in REFS:
        conn.execute(
            sa.text(f"UPDATE {table} SET {column} = :new WHERE {column} = :old"),  # noqa: S608
            {"old": old, "new": new},
        )


def put(conn, plan_id: str, spec) -> None:
    name, description, position, companies, dynamic, static, feats = spec
    conn.execute(
        sa.text(
            "INSERT INTO plans (id, name, description, max_qr_static, max_dynamic_qr, "
            "max_companies, features, position, is_active) VALUES (:id, :name, :description, "
            ":static, :dynamic, :companies, CAST(:features AS json), :position, true) "
            "ON CONFLICT (id) DO UPDATE SET name = :name, description = :description, "
            "max_qr_static = :static, max_dynamic_qr = :dynamic, max_companies = :companies, "
            "features = CAST(:features AS json), position = :position, is_active = true"
        ),
        dict(id=plan_id, name=name, description=description, static=static, dynamic=dynamic,
             companies=companies, features=json.dumps(feats), position=position),
    )  # fmt: skip


def upgrade() -> None:
    conn = op.get_bind()
    # 1. swap the identities of the old pro (3 companies) and plus (10 companies) through
    #    temporary rows, so every reference follows its plan.
    put(conn, "tmp_plus", PLANS["plus"])
    put(conn, "tmp_pro", PLANS["pro"])
    repoint(conn, "pro", "tmp_plus")
    repoint(conn, "plus", "tmp_pro")
    conn.execute(sa.text("DELETE FROM plans WHERE id IN ('pro', 'plus')"))
    put(conn, "plus", PLANS["plus"])
    put(conn, "pro", PLANS["pro"])
    repoint(conn, "tmp_plus", "plus")
    repoint(conn, "tmp_pro", "pro")
    conn.execute(sa.text("DELETE FROM plans WHERE id IN ('tmp_plus', 'tmp_pro')"))
    # 2. the other three
    for plan_id in ("free", "start", "agency"):
        put(conn, plan_id, PLANS[plan_id])
    # 3. every redirect works again (no more post-expiry window)
    conn.execute(sa.text("UPDATE workspaces SET redirects_until = NULL"))


def downgrade() -> None:
    # Data-only migration: the plan rows stay (the schema is unchanged). Plan identities were
    # swapped (old pro <-> plus), so a real rollback means restoring the backup.
    pass
