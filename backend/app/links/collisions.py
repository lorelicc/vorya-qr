"""Slugs and aliases that collide with a reserved word (a site path or a blocked word).

Used by `python -m app.cli check-reserved` and by migration 0016: a link that already exists
always wins over a new site route, so a collision must be seen BEFORE the new routes go live.
"""

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..models import LinkAlias, QrCode
from .reserved import BLOCKED_WORDS, ROUTE_WORDS


def find_collisions(session: Session) -> list[dict]:
    words = {w.lower() for w in ROUTE_WORDS | BLOCKED_WORDS}
    words |= set(session.execute(text("SELECT word FROM reserved_words")).scalars())
    found: list[dict] = []
    slugs = session.execute(
        select(QrCode.id, QrCode.slug)
        .where(QrCode.slug.is_not(None), func.lower(QrCode.slug).in_(words))
    ).all()  # fmt: skip
    found += [{"kind": "slug", "id": i, "value": s} for i, s in slugs]
    aliases = session.execute(
        select(LinkAlias.id, LinkAlias.alias, LinkAlias.removed_at).where(
            func.lower(LinkAlias.alias).in_(words)
        )
    ).all()
    found += [
        {"kind": "alias", "id": i, "value": a, "removed": r is not None} for i, a, r in aliases
    ]
    return found
