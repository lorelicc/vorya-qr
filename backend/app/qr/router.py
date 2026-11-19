import re
import unicodedata
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, rate_limit
from ..core.database import get_session
from ..core.errors import CodedError
from ..core.security import now
from ..models import Folder, LinkTag, QrCode, QrPage
from ..quotas import reserve_slot
from ..schemas.page import Page
from ..schemas.qr import QrCreate, QrOut, QrPreview, QrUpdate
from .contrast import warnings
from .design_service import design_from_payload, design_of, render
from .designer import svg_to_pdf, svg_to_png
from .render import PNG_DEFAULT, PNG_MAX, PNG_MIN, PREVIEW_SLUG, short_link
from .scan_check import check
from .service import (
    apply_content_change,
    encoded_content_of,
    get_owned,
    insert_qr,
    kind_of,
    qr_out,
    require_dynamic,
    scan_counts,
    sparklines,
    validate_content,
)

router = APIRouter(prefix="/api/companies/{company_id}/qr-codes", tags=["qr"])
NO_STORE = {"Cache-Control": "no-store, private"}


STYLE_FIELDS = ("fg_color", "bg_color", "margin", "error_correction")


def filename(name: str, extension: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:60] or "qr"
    return f"vorya-qr-{stem}.{extension}"


def _tags_of(session: Session, ids: list[int]) -> dict[int, list[int]]:
    found: dict[int, list[int]] = {}
    if ids:
        for qr_id, tag_id in session.execute(
            select(LinkTag.qr_code_id, LinkTag.tag_id).where(LinkTag.qr_code_id.in_(ids))
        ):
            found.setdefault(qr_id, []).append(tag_id)
    return found


class ListFilters:
    """Query parameters shared by the list and the CSV export (same filters, same order)."""

    def __init__(
        self,
        search: str = Query(default="", max_length=120),
        kind: Literal["", "static", "dynamic"] = "",
        status: Literal["", "active", "paused", "blocked"] = "",
        qr_type: str = Query(default="", max_length=16),
        view: Literal["", "links", "dynamic_qr", "static"] = "",
        folder: str = Query(default="", max_length=10),  # "", "none", or a folder id
        tag_ids: list[int] = Query(default_factory=list, max_length=10),  # all of them
        created_from: date | None = None,
        created_to: date | None = None,
        scans_min: int | None = Query(default=None, ge=0),
        scans_max: int | None = Query(default=None, ge=0),
        sort: Literal["created", "name", "scans", "updated"] = "created",
        order: Literal["asc", "desc"] = "desc",
    ):
        self.__dict__.update(locals())

    def query(self, company_id: int):
        f = self
        query = select(QrCode).where(QrCode.company_id == company_id, QrCode.deleted_at.is_(None))
        if f.view == "links":  # 0.3 unified list: short links without a QR yet
            query = query.where(QrCode.kind == "dynamic", QrCode.has_qr.is_(False))
        elif f.view == "dynamic_qr":
            query = query.where(QrCode.kind == "dynamic", QrCode.has_qr.is_(True))
        elif f.view == "static":
            query = query.where(QrCode.kind == "static")
        if f.search.strip():
            term = f"%{f.search.strip()}%"
            query = query.where(
                or_(QrCode.name.ilike(term), QrCode.target_url.ilike(term), QrCode.slug.ilike(term))
            )
        if f.folder == "none":
            query = query.where(QrCode.folder_id.is_(None))
        elif f.folder.isdigit():  # a folder includes its sub-folders
            children = select(Folder.id).where(Folder.parent_id == int(f.folder))
            query = query.where(
                or_(QrCode.folder_id == int(f.folder), QrCode.folder_id.in_(children))
            )
        for tag_id in f.tag_ids:
            query = query.where(
                QrCode.id.in_(select(LinkTag.qr_code_id).where(LinkTag.tag_id == tag_id))
            )
        if f.created_from:
            query = query.where(
                QrCode.created_at >= datetime.combine(f.created_from, time.min, UTC)
            )
        if f.created_to:
            end = datetime.combine(f.created_to + timedelta(days=1), time.min, UTC)
            query = query.where(QrCode.created_at < end)
        if f.scans_min is not None:
            query = query.where(QrCode.scan_total >= f.scans_min)
        if f.scans_max is not None:
            query = query.where(QrCode.scan_total <= f.scans_max)
        if f.kind:
            query = query.where(QrCode.kind == f.kind)
        if f.status:
            query = query.where(QrCode.status == f.status)
        if f.qr_type:
            query = query.where(QrCode.qr_type == f.qr_type)
        column = {"created": QrCode.created_at, "name": func.lower(QrCode.name),
                  "scans": QrCode.scan_total, "updated": QrCode.updated_at}[f.sort]  # fmt: skip
        direction = column.asc() if f.order == "asc" else column.desc()
        return query.order_by(direction, QrCode.id.desc())


@router.get("", response_model=list[QrOut])
def list_qr(
    filters: ListFilters = Depends(),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    items = list(session.scalars(filters.query(ctx.company.id)))
    tags = _tags_of(session, [qr.id for qr in items])
    counts = scan_counts(session, [qr.id for qr in items])
    sparks = sparklines(session, [qr.id for qr in items if qr.kind == "dynamic"])
    out = []
    for qr in items:
        item = qr_out(qr, counts.get(qr.id, 0))
        item.spark = sparks.get(qr.id)
        item.tag_ids = tags.get(qr.id, [])
        out.append(item)
    return out


@router.get("/export.csv")
def export_csv(
    filters: ListFilters = Depends(),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    """Every link and QR of the company, with the same filters as the list."""
    from ..imports.service import export_csv as build

    links = list(session.scalars(filters.query(ctx.company.id).limit(50_000)))
    return Response(
        build(session, ctx.company, links),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="vorya-qr-link-e-qr.csv"',
                 "Cache-Control": "no-store"},
    )  # fmt: skip


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
    change = apply_content_change(session, ctx, qr, payload)
    if change == "destination":
        audit(session, ctx.user, "qr.target_changed", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
    elif change == "type":
        audit(session, ctx.user, "link.type_changed", ctx.workspace.id, ctx.company.id,
              qr_id=qr.id, qr_type=qr.qr_type)  # fmt: skip
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


@router.post("/{qr_id}/generate-qr", response_model=QrOut)
def generate_qr(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    """A short link gets its QR format: same slug, so the QR encodes the existing link."""
    qr = get_owned(session, ctx, qr_id, lock=True)
    require_dynamic(qr)
    if not qr.has_qr:
        qr.has_qr = True
        audit(session, ctx.user, "link.qr_generated", ctx.workspace.id, ctx.company.id, qr_id=qr.id)
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
