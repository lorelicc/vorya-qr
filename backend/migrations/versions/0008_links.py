"""Vorya QR 0.3: short links as the main entity (a QR is one format of a link).

Additive only, and the table keeps its name: during a rolling deploy the 0.2 backend keeps
serving /r/{slug} from `qr_codes` while this migration runs.
- `has_qr`: true for every existing row (they are all QR codes); a pure short link has false.
- `scan_total`: human scans counter (backfilled), used by "expires after N scans".
- rule columns (expiry, password, schedule) live on the same row: the redirect stays one query.
- `scan_events.outcome`: scans stopped by a password or an expiry are counted apart.
- `reserved_words`: back-halves that can never be used (routes + misleading words).
- new plan features with provisional values (Start / Pro / Plus).

Revision ID: 0008_links
Revises: 0007_abuse
"""

import sqlalchemy as sa
from alembic import op

revision = "0008_links"
down_revision = "0007_abuse"
branch_labels = None
depends_on = None

FEATURES = {
    "start": dict(custom_back_half=False, max_aliases_per_link=0, link_rules=False,
                  utm_templates=False, max_bulk_rows=0, version_history=False, menu_type=False),
    "pro": dict(custom_back_half=True, max_aliases_per_link=3, link_rules=True,
                utm_templates=True, max_bulk_rows=500, version_history=True, menu_type=True),
    "plus": dict(custom_back_half=True, max_aliases_per_link=None, link_rules=True,
                 utm_templates=True, max_bulk_rows=5000, version_history=True, menu_type=True),
}  # fmt: skip


def upgrade() -> None:
    from app.links.reserved import BLOCKED_WORDS, ROUTE_WORDS

    op.add_column(
        "qr_codes", sa.Column("has_qr", sa.Boolean, nullable=False, server_default=sa.true())
    )
    op.add_column(
        "qr_codes", sa.Column("scan_total", sa.Integer, nullable=False, server_default="0")
    )
    op.add_column("qr_codes", sa.Column("expires_at", sa.DateTime(timezone=True)))
    op.add_column("qr_codes", sa.Column("max_scans", sa.Integer))
    op.add_column("qr_codes", sa.Column("fallback_url", sa.String(2048)))
    op.add_column("qr_codes", sa.Column("password_hash", sa.String(255)))
    op.add_column("qr_codes", sa.Column("schedule", sa.JSON))
    op.create_index("ix_qr_codes_lower_slug", "qr_codes", [sa.text("lower(slug)")])
    op.execute(
        "UPDATE qr_codes q SET scan_total = s.n FROM (SELECT qr_code_id, count(*) AS n "
        "FROM scan_events WHERE NOT is_bot GROUP BY qr_code_id) s WHERE s.qr_code_id = q.id"
    )
    op.add_column(
        "scan_events", sa.Column("outcome", sa.String(12), nullable=False, server_default="ok")
    )

    words = op.create_table(
        "reserved_words",
        sa.Column("word", sa.String(50), primary_key=True),
        sa.Column("kind", sa.String(8), nullable=False),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )  # fmt: skip
    op.bulk_insert(
        words,
        [{"word": w, "kind": "route"} for w in sorted(ROUTE_WORDS)]
        + [{"word": w, "kind": "blocked"} for w in sorted(BLOCKED_WORDS - ROUTE_WORDS)],
    )

    conn = op.get_bind()
    for plan_id, features in conn.execute(sa.text("SELECT id, features FROM plans")).all():
        extra = FEATURES.get(plan_id)
        if extra:
            merged = {**extra, **(features or {})}
            conn.execute(
                sa.text("UPDATE plans SET features = CAST(:f AS json) WHERE id = :id"),
                {"f": __import__("json").dumps(merged), "id": plan_id},
            )


def downgrade() -> None:
    op.drop_table("reserved_words")
    op.drop_column("scan_events", "outcome")
    op.drop_index("ix_qr_codes_lower_slug", "qr_codes")
    for column in ("schedule", "password_hash", "fallback_url", "max_scans", "expires_at",
                   "scan_total", "has_qr"):  # fmt: skip
        op.drop_column("qr_codes", column)
