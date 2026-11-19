import re
import unicodedata
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, rate_limit
from ..core.database import get_session
from ..core.errors import CodedError
from ..core.security import now
from ..models import QrCode, QrPage
from ..quotas import reserve_slot
from ..schemas.page import Page
from ..schemas.qr import QrCreate, QrOut, QrPreview, QrUpdate
from .contrast import warnings
from .design_service import design_from_payload, design_of, render
from .designer import svg_to_pdf, svg_to_png
from .render import PNG_DEFAULT, PNG_MAX, PNG_MIN, PREVIEW_SLUG, short_link
from .scan_check import check
from .service import (
    encoded_content_of,
    get_owned,
    insert_qr,
    kind_of,
    qr_out,
    require_dynamic,
    scan_counts,
    sparklines,
    update_content,
    validate_content,
)

router = APIRouter(prefix="/api/companies/{company_id}/qr-codes", tags=["qr"])
NO_STORE = {"Cache-Control": "no-store, private"}


STYLE_FIELDS = ("fg_color", "bg_color", "margin", "error_correction")


def filename(name: str, extension: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:60] or "qr"
    return f"vorya-qr-{stem}.{extension}"


@router.get("", response_model=list[QrOut])
def list_qr(
    search: str = Query(default="", max_length=120),
    kind: Literal["", "static", "dynamic"] = "",
    status: Literal["", "active", "paused", "blocked"] = "",
    qr_type: str = Query(default="", max_length=16),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    query = select(QrCode).where(QrCode.company_id == ctx.company.id, QrCode.deleted_at.is_(None))
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(QrCode.name.ilike(term), QrCode.target_url.ilike(term)))
    if kind:
        query = query.where(QrCode.kind == kind)
    if status:
        query = query.where(QrCode.status == status)
    if qr_type:
        query = query.where(QrCode.qr_type == qr_type)
    items = list(session.scalars(query.order_by(QrCode.created_at.desc(), QrCode.id.desc())))
    counts = scan_counts(session, [qr.id for qr in items])
    sparks = sparklines(session, [qr.id for qr in items if qr.kind == "dynamic"])
    out = []
    for qr in items:
        item = qr_out(qr, counts.get(qr.id, 0))
        item.spark = sparks.get(qr.id)
        out.append(item)
    return out


@router.post("", response_model=QrOut, status_code=201)
def create_qr(
    payload: QrCreate,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    if not rate_limit(session, "qr-create", str(ctx.workspace.id), 120, 3600):
        raise HTTPException(429, "Troppi QR creati in poco tempo. Riprova più tardi.")
    reserve_slot(session, ctx.workspace.id, kind_of(payload.qr_type, payload.dynamic)[0])
    qr = insert_qr(session, ctx, payload)
    audit(session, ctx.user, "qr.created", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    session.commit()
    return qr_out(qr)


@router.post("/preview")
def preview(
    payload: QrPreview,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    kind, _ = kind_of(payload.qr_type, payload.dynamic)
    if kind == "dynamic":
        slug = get_owned(session, ctx, payload.qr_id).slug if payload.qr_id else PREVIEW_SLUG
        content = short_link(slug)
    else:
        from .static_types import encode_static

        try:
            _, data, _ = validate_content(session, ctx, payload.qr_type, kind, payload)
            content = encode_static(payload.qr_type, data)
        except Exception:  # noqa: BLE001 - incomplete forms still get a placeholder preview
            content = "https://qr.vorya.it"
    design = design_from_payload(payload)
    svg = render(session, ctx.company.id, content, design)
    return {
        "svg": svg,
        "content": content,
        "error_correction": design.error_correction,
        "warnings": warnings(design.fill.color, design.background, design.margin),
        "scannability": check(content, design, svg),
    }


@router.get("/{qr_id}", response_model=QrOut)
def get_qr(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    return qr_out(qr, scan_counts(session, [qr.id]).get(qr.id, 0))


@router.put("/{qr_id}", response_model=QrOut)
def update_qr(
    qr_id: int,
    payload: QrUpdate,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id, lock=True)
    qr.name = payload.name
    for field in STYLE_FIELDS:
        setattr(qr, field, getattr(payload, field))
    if update_content(session, ctx, qr, payload):
        audit(session, ctx.user, "qr.target_changed", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    session.commit()
    return qr_out(qr, scan_counts(session, [qr.id]).get(qr.id, 0))


@router.get("/{qr_id}/page", response_model=Page)
def get_page(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    row = session.get(QrPage, qr.id)
    if row is None:
        raise HTTPException(404, "Questo QR non ha una pagina.")
    return row.document


@router.post("/{qr_id}/duplicate", response_model=QrOut, status_code=201)
def duplicate_qr(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    source = get_owned(session, ctx, qr_id)
    page = session.get(QrPage, source.id)
    payload = QrCreate(
        name=f"{source.name} (copia)"[:120], qr_type=source.qr_type,
        dynamic=source.kind == "dynamic",
        target_url=source.target_url, static_data=source.static_data,
        page=Page.model_validate(page.document) if page else None,
        **{f: getattr(source, f) for f in STYLE_FIELDS},
    )  # fmt: skip
    reserve_slot(session, ctx.workspace.id, source.kind)
    qr = insert_qr(session, ctx, payload)
    qr.design = source.design
    audit(session, ctx.user, "qr.duplicated", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    session.commit()
    return qr_out(qr)


@router.post("/{qr_id}/{action}", response_model=QrOut)
def set_status(
    qr_id: int,
    action: Literal["pause", "resume"],
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id, lock=True)
    require_dynamic(qr)
    if qr.status == "blocked":
        raise CodedError(
            403, "Questo QR è stato bloccato dal team Vorya: contatta il supporto.", "qr_blocked"
        )
    qr.status = "paused" if action == "pause" else "active"
    audit(session, ctx.user, f"qr.{action}", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    session.commit()
    return qr_out(qr, scan_counts(session, [qr.id]).get(qr.id, 0))


@router.delete("/{qr_id}", status_code=204)
def delete_qr(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id, lock=True)
    qr.deleted_at = now()  # soft delete: the slug is never reused
    audit(session, ctx.user, "qr.deleted", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    session.commit()


def _image(session: Session, ctx, qr: QrCode) -> str:
    return render(session, ctx.company.id, encoded_content_of(qr), design_of(qr))


def _download(data, media_type: str, name: str, extension: str, extra: dict | None = None):
    return Response(
        data,
        media_type=media_type,
        headers={
            **NO_STORE,
            "Content-Disposition": f'attachment; filename="{filename(name, extension)}"',
            **(extra or {}),
        },
    )


@router.get("/{qr_id}/image.svg")
def image_svg(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    return _download(_image(session, ctx, qr), "image/svg+xml", qr.name, "svg")


@router.get("/{qr_id}/image.png")
def image_png(
    qr_id: int,
    size: int = Query(default=PNG_DEFAULT, ge=PNG_MIN, le=PNG_MAX),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    png = svg_to_png(_image(session, ctx, qr), size)
    return _download(png, "image/png", qr.name, "png", {"X-Image-Size": str(size)})


@router.get("/{qr_id}/image.pdf")
def image_pdf(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    return _download(svg_to_pdf(_image(session, ctx, qr)), "application/pdf", qr.name, "pdf")
