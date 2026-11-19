"""Short-link helpers. The image itself is drawn by designer.py."""

import secrets

from ..core.config import get_settings

SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"  # no 0/O, 1/l/I
SLUG_LENGTH = 7
PREVIEW_SLUG = "x" * SLUG_LENGTH  # same length => same QR version as the real link
PNG_MIN, PNG_MAX, PNG_DEFAULT = 128, 4096, 1024


def new_slug() -> str:
    from ..links.reserved import BLOCKED_WORDS, ROUTE_WORDS

    while True:
        slug = "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))
        if slug.lower() not in ROUTE_WORDS and slug.lower() not in BLOCKED_WORDS:
            return slug


def short_link(slug: str) -> str:
    """Printed QR codes always use /r/{slug}: this format never changes."""
    return f"{get_settings().short_link_base_url}/r/{slug}"


def root_link(back_half: str) -> str:
    """0.3 shorter form, resolved by the same redirect: https://qr.vorya.it/{slug-or-alias}."""
    return f"{get_settings().short_link_base_url}/{back_half}"
