"""Single source of truth for the QR image: segno builds the matrix, this module draws the SVG.
PNG and PDF are derived from the very same SVG with cairosvg, so exports match the preview.

Finder patterns ("eyes") are always drawn as separate solid shapes: dotted eyes are not
reliably decoded (verified while designing 0.2).
"""

import base64
import io
import math
from xml.sax.saxutils import escape

import cairosvg
import segno

from ..schemas.design import QrDesign

CELL = 10  # SVG units per module


def matrix(content: str, error_correction: str) -> list[list[bool]]:
    qr = segno.make(content, error=error_correction.lower(), micro=False, boost_error=False)
    return [[bool(v) for v in row] for row in qr.matrix]


def _in_eye(x: int, y: int, n: int) -> bool:
    return (x < 7 and y < 7) or (x >= n - 7 and y < 7) or (x < 7 and y >= n - 7)


def _rounded_rect(
    x: float, y: float, w: float, h: float, r: tuple[float, float, float, float]
) -> str:
    """Path for a rect with per-corner radii (tl, tr, br, bl)."""
    tl, tr, br, bl = r
    return (
        f"M{x + tl} {y}H{x + w - tr}" + (f"A{tr} {tr} 0 0 1 {x + w} {y + tr}" if tr else "")
        + f"V{y + h - br}" + (f"A{br} {br} 0 0 1 {x + w - br} {y + h}" if br else "")
        + f"H{x + bl}" + (f"A{bl} {bl} 0 0 1 {x} {y + h - bl}" if bl else "")
        + f"V{y + tl}" + (f"A{tl} {tl} 0 0 1 {x + tl} {y}" if tl else "") + "Z"
    )  # fmt: skip


def _module(shape: str, m: list[list[bool]], x: int, y: int, ox: float, oy: float) -> str:
    n = len(m)
    px, py, c = ox + x * CELL, oy + y * CELL, CELL

    def on(dx: int, dy: int) -> bool:
        i, j = x + dx, y + dy
        return 0 <= i < n and 0 <= j < n and m[j][i] and not _in_eye(i, j, n)

    if shape == "dots":
        return f"M{px + c / 2 - 4.5} {py + c / 2}a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0Z"
    if shape == "rounded":
        return _rounded_rect(px + 0.4, py + 0.4, c - 0.8, c - 0.8, (3, 3, 3, 3))
    if shape == "classy":
        return _rounded_rect(px, py, c, c, (4, 0, 4, 0))
    if shape == "extra_rounded":  # contextual: round only the corners with no neighbours
        up, down, left, right = on(0, -1), on(0, 1), on(-1, 0), on(1, 0)
        r = c / 2
        radii = (
            0 if up or left else r, 0 if up or right else r,
            0 if down or right else r, 0 if down or left else r,
        )  # fmt: skip
        return _rounded_rect(px, py, c, c, radii)
    return f"M{px} {py}h{c + 0.05}v{c + 0.05}h-{c + 0.05}Z"  # tiny overlap avoids hairlines


def _eye(frame: str, ball: str, ex: float, ey: float) -> tuple[str, str]:
    s, c = 7 * CELL, CELL
    frame_radius = {"square": 0, "rounded": 16, "circle": s / 2, "leaf": 0, "extra_rounded": 24}
    if frame == "leaf":
        outer = _rounded_rect(ex, ey, s, s, (28, 0, 28, 0))
        inner = _rounded_rect(ex + c, ey + c, s - 2 * c, s - 2 * c, (18, 0, 18, 0))
    else:
        r = frame_radius[frame]
        outer = _rounded_rect(ex, ey, s, s, (r,) * 4)
        ri = max(r - c, 0) if frame != "circle" else (s - 2 * c) / 2
        inner = _rounded_rect(ex + c, ey + c, s - 2 * c, s - 2 * c, (ri,) * 4)
    bx, by, bs = ex + 2 * c, ey + 2 * c, 3 * c
    radius = {"square": 0, "rounded": 6, "circle": bs / 2}.get(ball, 0)
    corners = (12, 0, 12, 0) if ball == "leaf" else (radius,) * 4
    ball_path = _rounded_rect(bx, by, bs, bs, corners)
    return outer + inner, ball_path


def _paint(design: QrDesign, size: float) -> tuple[str, str]:
    """(defs, fill reference) for the module fill."""
    f = design.fill
    if f.type == "solid":
        return "", f.color
    if f.type == "radial":
        return (
            f'<radialGradient id="qf" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="{f.color}"/>'
            f'<stop offset="1" stop-color="{f.color2}"/></radialGradient>', "url(#qf)"
        )  # fmt: skip
    rad = math.radians(f.angle)
    x1, y1 = 50 - 50 * math.cos(rad), 50 - 50 * math.sin(rad)
    x2, y2 = 50 + 50 * math.cos(rad), 50 + 50 * math.sin(rad)
    return (
        f'<linearGradient id="qf" gradientUnits="userSpaceOnUse" x1="{x1 * size / 100:.1f}" '
        f'y1="{y1 * size / 100:.1f}" x2="{x2 * size / 100:.1f}" y2="{y2 * size / 100:.1f}">'
        f'<stop offset="0" stop-color="{f.color}"/><stop offset="1" stop-color="{f.color2}"/>'
        "</linearGradient>", "url(#qf)"
    )  # fmt: skip


def render_svg(content: str, design: QrDesign, logo_png: bytes | None = None) -> str:
    m = matrix(content, design.error_correction)
    n = len(m)
    size = (n + 2 * design.margin) * CELL
    o = design.margin * CELL
    logo_cells = 0.0
    if design.logo and logo_png:
        logo_cells = n * (design.logo.size + 2 * design.logo.padding)
    lo, hi = (n - logo_cells) / 2, (n + logo_cells) / 2

    def cleared(x: int, y: int) -> bool:  # modules hidden under the logo area
        return logo_cells > 0 and lo - 0.5 < x + 0.5 < hi + 0.5 and lo - 0.5 < y + 0.5 < hi + 0.5

    modules = "".join(
        _module(design.modules, m, x, y, o, o)
        for y in range(n) for x in range(n)
        if m[y][x] and not _in_eye(x, y, n) and not cleared(x, y)
    )  # fmt: skip
    frames, balls = zip(*(_eye(design.eye_frame, design.eye_ball, o + ex * CELL, o + ey * CELL)
                          for ex, ey in ((0, 0), (n - 7, 0), (0, n - 7))), strict=True)  # fmt: skip
    defs, fill = _paint(design, size)
    eye = design.eye_color or fill
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" '
        f'height="{size}" shape-rendering="geometricPrecision"><title>Codice QR</title>',
        f"<defs>{defs}</defs>" if defs else "",
        ""
        if design.transparent
        else f'<rect width="{size}" height="{size}" fill="{design.background}"/>',
        f'<path fill="{fill}" d="{modules}"/>',
        f'<path fill="{eye}" fill-rule="evenodd" d="{"".join(frames)}"/>',
        f'<path fill="{eye}" d="{"".join(balls)}"/>',
    ]
    if logo_cells:
        side, pad = n * design.logo.size * CELL, n * design.logo.padding * CELL
        start = o + (n * CELL - side) / 2
        if design.logo.plate:
            plate = side + 2 * pad
            parts.append(
                f'<rect x="{start - pad:.1f}" y="{start - pad:.1f}" width="{plate:.1f}" height="{plate:.1f}" '
                f'rx="{plate * 0.18:.1f}" fill="{design.background if not design.transparent else "#ffffff"}"/>'
            )  # fmt: skip
        data = base64.b64encode(logo_png).decode()
        parts.append(
            f'<image x="{start:.1f}" y="{start:.1f}" width="{side:.1f}" height="{side:.1f}" '
            f'preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,{escape(data)}"/>'
        )
    parts.append("</svg>")
    return "".join(parts)


def svg_to_png(svg: str, size: int) -> bytes:
    return cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)


def svg_to_pdf(svg: str) -> bytes:
    return cairosvg.svg2pdf(bytestring=svg.encode())


def logo_as_png(webp_or_png: bytes) -> bytes:
    """cairosvg needs PNG/JPEG data URIs; stored logos are WebP."""
    from PIL import Image

    buffer = io.BytesIO()
    Image.open(io.BytesIO(webp_or_png)).convert("RGBA").save(buffer, "PNG")
    return buffer.getvalue()
