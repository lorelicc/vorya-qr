"""Verified scannability: the rendered QR is decoded with zxing-cpp at every preview and save.

Decoding is done like a phone camera would (no automatic inversion) on a downscaled render,
composited on white when the background is transparent. When decoding fails, the likely
reasons (contrast, inversion, logo size, margin) are reported so the user can fix them.
"""

import io

import zxingcpp
from PIL import Image

from ..schemas.design import QrDesign
from .contrast import contrast_ratio, luminance
from .designer import svg_to_png

CHECK_SIZE = 480  # small render: a faithful proxy of a printed QR seen by a phone camera

MESSAGES = {
    "unreadable": "Il QR non viene letto: cambia stile o colori finché il badge non torna verde.",
    "low_contrast": "Contrasto insufficiente tra i colori del QR e lo sfondo.",
    "inverted": "I moduli sono più chiari dello sfondo: molte fotocamere non li leggono.",
    "logo_large": "Il logo copre troppa superficie: riducilo o aumenta il padding.",
    "small_margin": "Margine ridotto: lascia almeno 2 moduli di spazio attorno al QR.",
    "transparent": "Sfondo trasparente: stampalo su uno sfondo chiaro e uniforme.",
}


def _colors(design: QrDesign) -> list[str]:
    colors = [design.fill.color]
    if design.fill.type != "solid":
        colors.append(design.fill.color2)
    if design.eye_color:
        colors.append(design.eye_color)
    return colors


def decode(svg: str) -> list[str]:
    png = svg_to_png(svg, CHECK_SIZE)
    image = Image.open(io.BytesIO(png)).convert("RGBA")
    flat = Image.new("RGBA", image.size, "#ffffff")
    flat.alpha_composite(image)
    results = zxingcpp.read_barcodes(
        flat.convert("L"), formats=zxingcpp.BarcodeFormat.QRCode, try_invert=False
    )
    return [r.text for r in results]


HARD_CONTRAST = 3.0  # below this a phone camera on a print is unreliable even if zxing reads it
SOFT_CONTRAST = 4.0


def check(content: str, design: QrDesign, svg: str) -> dict:
    """Decoding a perfect digital render is easier than reading a print with a phone, so the
    gate also enforces hard rules: contrast >= 3:1 and dark modules on a light background."""
    background = "#ffffff" if design.transparent else design.background
    colors = _colors(design)
    ratio = min(contrast_ratio(c, background) for c in colors)
    decoded = content in decode(svg)
    reasons: list[tuple[str, bool]] = []  # (code, blocking)
    if not decoded:
        reasons.append(("unreadable", True))
    if ratio < SOFT_CONTRAST:
        reasons.append(("low_contrast", ratio < HARD_CONTRAST))
    if any(luminance(c) > luminance(background) for c in colors):
        reasons.append(("inverted", True))
    if design.logo and design.logo.size + 2 * design.logo.padding > 0.3:
        reasons.append(("logo_large", False))
    if design.margin < 2:
        reasons.append(("small_margin", False))
    if design.transparent:
        reasons.append(("transparent", False))
    return {
        "scannable": not any(blocking for _, blocking in reasons),
        "reasons": [
            {"code": code, "message": MESSAGES[code], "blocking": blocking}
            for code, blocking in reasons
        ],
    }
