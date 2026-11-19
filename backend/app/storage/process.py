"""Turns an upload into stored variants.

Images are re-encoded with Pillow (orientation applied, EXIF/GPS and every other metadata
dropped because only pixels are copied) into WebP variants. PDFs are validated with pdfium
and get WebP previews of the first pages (iPhone shows only page 1 of an inline PDF).
Audio is stored as-is.
"""

import io
from dataclasses import dataclass, field

from PIL import Image, ImageOps

from .sniff import Sniffed

Image.MAX_IMAGE_PIXELS = 40_000_000  # decompression-bomb guard (about 6300 x 6300)

IMAGE_VARIANTS = {
    # purpose: {variant: (max width, max height, square crop)}
    "image": {"large": (1600, 1600, False), "thumb": (320, 320, False)},
    "cover": {"large": (1600, 900, False), "thumb": (400, 225, False)},
    "avatar": {"large": (512, 512, True), "thumb": (128, 128, True)},
    "gallery": {"large": (1600, 1600, False), "thumb": (480, 480, True)},
    "logo": {"logo": (512, 512, False), "thumb": (128, 128, False)},
}
PDF_PREVIEW_PAGES = 5
PDF_PREVIEW_WIDTH = 1000


class InvalidFile(ValueError):
    pass


@dataclass
class Variant:
    name: str
    data: bytes
    mime: str
    width: int | None = None
    height: int | None = None


@dataclass
class Processed:
    variants: list[Variant]
    meta: dict = field(default_factory=dict)


def _webp(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "WEBP", quality=82, method=4)
    return buffer.getvalue()


def _open_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (Image.DecompressionBombError, OSError, ValueError) as exc:
        raise InvalidFile("Immagine non valida o troppo grande.") from exc
    image = ImageOps.exif_transpose(image)
    mode = "RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB"
    # A fresh image without info/exif: metadata (EXIF, GPS, XMP, ICC) is not carried over.
    clean = Image.new(mode, image.size)
    clean.paste(image.convert(mode))
    return clean


def process_image(data: bytes, purpose: str) -> Processed:
    image = _open_image(data)
    variants = []
    for name, (max_w, max_h, square) in IMAGE_VARIANTS.get(
        purpose, IMAGE_VARIANTS["image"]
    ).items():
        if square:
            resized = ImageOps.fit(image, (max_w, max_h), Image.Resampling.LANCZOS)
        else:
            resized = image.copy()
            resized.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
        variants.append(Variant(name, _webp(resized), "image/webp", *resized.size))
    return Processed(variants, {"width": image.width, "height": image.height})


def process_pdf(data: bytes) -> Processed:
    import pypdfium2 as pdfium

    try:
        document = pdfium.PdfDocument(data)
        pages = len(document)
    except pdfium.PdfiumError as exc:
        raise InvalidFile("PDF non valido o protetto da password.") from exc
    variants = [Variant("original", data, "application/pdf")]
    for index in range(min(pages, PDF_PREVIEW_PAGES)):
        page = document[index]
        scale = PDF_PREVIEW_WIDTH / max(page.get_width(), 1)
        bitmap = page.render(scale=min(scale, 3)).to_pil().convert("RGB")
        variants.append(Variant(f"page_{index + 1}", _webp(bitmap), "image/webp", *bitmap.size))
    document.close()
    return Processed(variants, {"pages": pages})


def process(data: bytes, sniffed: Sniffed, purpose: str) -> Processed:
    if sniffed.kind == "image":
        return process_image(data, purpose)
    if sniffed.kind == "pdf":
        return process_pdf(data)
    return Processed([Variant("original", data, sniffed.mime)])
