import re
import unicodedata
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit
from ..core.database import get_session
from ..core.security import now
from ..models import QrCode
from ..quotas import reserve_slot
from ..schemas.qr import QrCreate, QrOut, QrPreview, QrUpdate
from .contrast import warnings
from .render import PNG_DEFAULT, PNG_MAX, PNG_MIN, encoded_content, render_png, render_svg
from .service import get_owned, insert_qr, qr_out, require_dynamic, scan_counts

router = APIRouter(prefix="/api/companies/{company_id}/qr-codes", tags=["qr"])
NO_STORE = {"Cache-Control": "no-store, private"}


def style(qr) -> dict:
    return {
        "fg": qr.fg_color,
        "bg": qr.bg_color,
        "margin": qr.margin,
        "error_correction": qr.error_correction,
    }


def filename(name: str, extension: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:60] or "qr"
    return f"vorya-qr-{stem}.{extension}"


@router.get("", response_model=list[QrOut])
def list_qr(
    search: str = Query(default="", max_length=120),
    kind: Literal["", "static", "dynamic"] = "",
    status: Literal["", "active", "paused"] = "",
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
    items = list(session.scalars(query.order_by(QrCode.created_at.desc(), QrCode.id.desc())))
    counts = scan_counts(session, [qr.id for qr in items])
    return [qr_out(qr, counts.get(qr.id, 0)) for qr in items]


@router.post("", response_model=QrOut, status_code=201)
def create_qr(
    payload: QrCreate,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    reserve_slot(session, ctx.workspace.id, payload.kind)
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
    slug = None
    if payload.qr_id is not None:
        slug = get_owned(session, ctx, payload.qr_id).slug
    content = encoded_content(payload.kind, payload.target_url or "https://", slug)
    svg = render_svg(
        content,
        fg=payload.fg_color,
        bg=payload.bg_color,
        margin=payload.margin,
        error_correction=payload.error_correction,
    )
    return {
        "svg": svg,
        "content": content,
        "warnings": warnings(payload.fg_color, payload.bg_color, payload.margin),
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
    changed_target = qr.target_url != payload.target_url
    for field, value in payload.model_dump().items():
        setattr(qr, field, value)
    if changed_target:
        audit(session, ctx.user, "qr.target_changed", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    session.commit()
    return qr_out(qr, scan_counts(session, [qr.id]).get(qr.id, 0))


@router.post("/{qr_id}/{action}", response_model=QrOut)
def set_status(
    qr_id: int,
    action: Literal["pause", "resume"],
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id, lock=True)
    require_dynamic(qr)
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


@router.get("/{qr_id}/image.svg")
def image_svg(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    svg = render_svg(encoded_content(qr.kind, qr.target_url, qr.slug), **style(qr))
    return Response(
        svg,
        media_type="image/svg+xml",
        headers={
            **NO_STORE,
            "Content-Disposition": f'attachment; filename="{filename(qr.name, "svg")}"',
        },
    )


@router.get("/{qr_id}/image.png")
def image_png(
    qr_id: int,
    size: int = Query(default=PNG_DEFAULT, ge=PNG_MIN, le=PNG_MAX),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    png, real_size = render_png(
        encoded_content(qr.kind, qr.target_url, qr.slug), size=size, **style(qr)
    )
    return Response(
        png,
        media_type="image/png",
        headers={
            **NO_STORE,
            "Content-Disposition": f'attachment; filename="{filename(qr.name, "png")}"',
            "X-Image-Size": str(real_size),
        },
    )
