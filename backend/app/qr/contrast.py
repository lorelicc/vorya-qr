"""Scan-readability checks. The same rules live in frontend/lib/contrast.ts for live feedback."""

MIN_CONTRAST = 4.0
MIN_MARGIN = 2

MESSAGES = {
    "low_contrast": (
        "Contrasto insufficiente tra primo piano e sfondo: il QR potrebbe non essere letto."
    ),
    "inverted": (
        "Il primo piano è più chiaro dello sfondo: molte app di scansione non leggono i QR "
        "invertiti."
    ),
    "small_margin": (
        "Margine ridotto: lascia almeno 2 moduli (consigliati 4) di spazio attorno al QR."
    ),
}


def _channel(value: int) -> float:
    c = value / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    value = hex_color.lstrip("#")
    r, g, b = (int(value[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast_ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    light, dark = max(la, lb), min(la, lb)
    return (light + 0.05) / (dark + 0.05)


def warnings(fg: str, bg: str, margin: int) -> list[dict]:
    codes = []
    if contrast_ratio(fg, bg) < MIN_CONTRAST:
        codes.append("low_contrast")
    if luminance(fg) > luminance(bg):
        codes.append("inverted")
    if margin < MIN_MARGIN:
        codes.append("small_margin")
    return [{"code": code, "message": MESSAGES[code]} for code in codes]
