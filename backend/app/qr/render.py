"""Short-link helpers. The image itself is drawn by designer.py."""

import secrets

from ..core.config import get_settings

SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"  # no 0/O, 1/l/I
SLUG_LENGTH = 7
PREVIEW_SLUG = "x" * SLUG_LENGTH  # same length => same QR version as the real link
PNG_MIN, PNG_MAX, PNG_DEFAULT = 128, 4096, 1024


def new_slug() -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))


def short_link(slug: str) -> str:
    return f"{get_settings().short_link_base_url}/r/{slug}"
