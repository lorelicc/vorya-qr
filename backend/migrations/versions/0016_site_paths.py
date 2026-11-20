"""Vorya QR 0.5: guard before the public site paths go live.

The site owns first-level paths such as /prezzi or /guide. A back-half (alias) or slug that
already uses one of them would be shadowed: this migration stops with a clear list instead of
breaking someone's link in silence. Fix by renaming the colliding alias/slug (or the site path);
`VORYA_ALLOW_RESERVED_COLLISIONS=1` lets the migration continue knowingly.

Revision ID: 0016_site_paths
Revises: 0015_plans
"""

import os

from alembic import op
from sqlalchemy.orm import Session

revision = "0016_site_paths"
down_revision = "0015_plans"
branch_labels = depends_on = None


def upgrade() -> None:
    from app.links.collisions import find_collisions

    found = find_collisions(Session(bind=op.get_bind()))
    if found and os.environ.get("VORYA_ALLOW_RESERVED_COLLISIONS") != "1":
        listing = "; ".join(f"{c['kind']} #{c['id']} «{c['value']}»" for c in found)
        raise RuntimeError(
            "Slug/alias in conflitto con i percorsi del sito: " + listing + ". "
            "Esegui `python -m app.cli check-reserved`, rinomina e riprova."
        )


def downgrade() -> None:
    pass
