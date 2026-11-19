"""Server-side QR rendering with segno (PNG and SVG). No Pillow needed."""

import io
import secrets

import segno

from ..core.config import get_settings

SLUG_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"  # no 0/O, 1/l/I
SLUG_LENGTH = 7
PREVIEW_SLUG = "x" * SLUG_LENGTH  # same length => same QR version as the real link
PNG_MIN, PNG_MAX, PNG_DEFAULT = 128, 4096, 1024


def new_slug() -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(SLUG_LENGTH))


def short_link(slug: str) -> str:
    return f"{get_settings().short_link_base_url}/r/{slug}"


def encoded_content(kind: str, target_url: str, slug: str | None) -> str:
    return short_link(slug or PREVIEW_SLUG) if kind == "dynamic" else target_url


def _make(content: str, error_correction: str) -> segno.QRCode:
    return segno.make(content, error=error_correction.lower(), micro=False, boost_error=False)


def render_svg(content: str, *, fg: str, bg: str, margin: int, error_correction: str) -> str:
    qr = _make(content, error_correction)
    buffer = io.BytesIO()
    qr.save(
        buffer,
        kind="svg",
        scale=10,
        border=margin,
        dark=fg,
        light=bg,
        xmldecl=False,
        svgns=True,
        title="Codice QR",
    )
    return buffer.getvalue().decode()


def render_png(
    content: str, *, fg: str, bg: str, margin: int, error_correction: str, size: int
) -> tuple[bytes, int]:
    """Renders at the largest integer scale that fits `size`; returns (png, real_size)."""
    qr = _make(content, error_correction)
    modules = qr.symbol_size(scale=1, border=margin)[0]
    scale = max(1, size // modules)
    buffer = io.BytesIO()
    qr.save(buffer, kind="png", scale=scale, border=margin, dark=fg, light=bg)
    return buffer.getvalue(), modules * scale
