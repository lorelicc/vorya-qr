"""Builds the PLACEHOLDER logo public/assets/branding/vorya_qr.png.

It reuses the "V" mark and "vorya." wordmark of vorya_sign.png (Vorya Sign) and writes "qr"
in the same accent green. To be replaced by the official artwork.
Usage: python3 scripts/make-placeholder-logo.py <path/to/vorya_sign.png>
Requires Pillow and the Inter ExtraLight font.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraLight.otf"
GREEN = (0, 246, 160, 255)
CUT = 1290  # end of "vorya." in vorya_sign.png (1732 x 352)

source = Image.open(sys.argv[1]).convert("RGBA")
base = source.crop((0, 0, CUT, source.height))
font = ImageFont.truetype(FONT, 230)
text = "qr"
left, top, right, bottom = font.getbbox(text, anchor="ls")
canvas = Image.new("RGBA", (CUT + right + 40, source.height), (0, 0, 0, 0))
canvas.paste(base, (0, 0))
ImageDraw.Draw(canvas).text((CUT + 10, 242), text, font=font, fill=GREEN, anchor="ls")
out = Path(__file__).resolve().parent.parent / "public/assets/branding/vorya_qr.png"
canvas.save(out, optimize=True)
print(out, canvas.size)
