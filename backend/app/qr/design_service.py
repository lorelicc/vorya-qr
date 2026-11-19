"""Design resolution, logo loading, rendering and the scannability gate."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.errors import CodedError
from ..models import QrCode, StoredFile
from ..schemas.design import QrDesign
from ..schemas.qr import QrContent
from ..storage.backends import get_storage
from .designer import logo_as_png, render_svg
from .scan_check import check


def design_from_payload(payload: QrContent) -> QrDesign:
    if payload.design is not None:
        return payload.design
    return QrDesign.from_legacy(payload.fg_color, payload.bg_color, payload.margin,
                                payload.error_correction)  # fmt: skip


def design_of(qr: QrCode) -> QrDesign:
    if qr.design:
        return QrDesign.model_validate(qr.design)
    return QrDesign.from_legacy(qr.fg_color, qr.bg_color, qr.margin, qr.error_correction)


def apply_design(qr: QrCode, design: QrDesign) -> None:
    """Stores the design and keeps the 0.1 columns in sync (solid color, background, margin)."""
    qr.design = design.model_dump(mode="json")
    qr.fg_color, qr.bg_color = design.fill.color, design.background
    qr.margin, qr.error_correction = design.margin, design.error_correction


def logo_png(session: Session, company_id: int, design: QrDesign) -> bytes | None:
    if design.logo is None:
        return None
    file = session.scalar(
        select(StoredFile).where(
            StoredFile.id == design.logo.file_id, StoredFile.company_id == company_id,
            StoredFile.kind == "image", StoredFile.deleted_at.is_(None),
        )
    )  # fmt: skip
    if file is None:
        raise HTTPException(422, "Il logo non è disponibile: caricalo di nuovo.")
    variant = file.variants.get("logo") or file.variants.get("large")
    data = b"".join(get_storage().read(variant["key"]))
    return logo_as_png(data)


def render(session: Session, company_id: int, content: str, design: QrDesign) -> str:
    return render_svg(content, design, logo_png(session, company_id, design))


def require_scannable(content: str, design: QrDesign, svg: str) -> dict:
    result = check(content, design, svg)
    if not result["scannable"]:
        blocking = [r["message"] for r in result["reasons"] if r["blocking"]]
        error = CodedError(422, " ".join(blocking), "unscannable")
        error.field = "design"  # type: ignore[attr-defined]
        raise error
    return result
