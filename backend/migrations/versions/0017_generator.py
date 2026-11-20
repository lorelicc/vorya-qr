"""Vorya QR 0.5: public generator (anonymous counters) and signup attribution.

- `generator_counters`: aggregate, anonymous counts per day / event / QR type / landing page.
  Nothing else about the visitor is ever stored by the free generator.
- `registrations.attribution` / `workspaces.attribution`: where the signup came from (utm_*,
  referrer host, landing page, "generatore gratuito") for the admin funnel.
- `registrations.handoff`: the static QR the visitor was making (type, content, style) so that
  after the email verification the dynamic QR exists already. The logo is never kept.

Revision ID: 0017_generator
Revises: 0016_site_paths
"""

import sqlalchemy as sa
from alembic import op

revision = "0017_generator"
down_revision = "0016_site_paths"
branch_labels = depends_on = None


def upgrade() -> None:
    op.create_table(
        "generator_counters",
        sa.Column("day", sa.Date, primary_key=True),
        sa.Column("event", sa.String(12), primary_key=True),  # view | preview | download
        sa.Column("qr_type", sa.String(16), primary_key=True),
        sa.Column("landing", sa.String(64), primary_key=True),
        sa.Column("count", sa.Integer, nullable=False, server_default="0"),
    )
    op.add_column("registrations", sa.Column("attribution", sa.JSON))
    op.add_column("registrations", sa.Column("handoff", sa.JSON))
    op.add_column("workspaces", sa.Column("attribution", sa.JSON))


def downgrade() -> None:
    op.drop_column("workspaces", "attribution")
    op.drop_column("registrations", "handoff")
    op.drop_column("registrations", "attribution")
    op.drop_table("generator_counters")
