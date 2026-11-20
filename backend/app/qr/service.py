from datetime import timedelta

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.errors import CodedError
from ..models import QrCode, QrPage, ScanEvent, StoredFile
from ..plans import PAGE_TYPES, STATIC_TYPES, plan_of, require_type
from ..schemas.page import Page
from ..schemas.qr import QrContent, QrCreate, QrOut, valid_url
from .render import new_slug, root_link, short_link
from .static_types import STATIC_SCHEMAS, encode_static

SLUG_ATTEMPTS = 8
# Which file kinds each kind of reference accepts.
FILE_KINDS = {"tracks": "audio", "file": "pdf"}


def scan_counts(session: Session, qr_ids: list[int]) -> dict[int, int]:
    if not qr_ids:
        return {}
    rows = session.execute(
        select(ScanEvent.qr_code_id, func.count())
        .where(
            ScanEvent.qr_code_id.in_(qr_ids),
            ScanEvent.is_bot.is_(False),
            ScanEvent.outcome == "ok",
        )
        .group_by(ScanEvent.qr_code_id)
    ).all()
    return dict(rows)


def sparklines(session: Session, qr_ids: list[int], days: int = 7) -> dict[int, list[int]]:
    """Daily human scans of the last `days` days (Europe/Rome), oldest first."""
    from ..stats.periods import bounds, local_today
    from ..stats.queries import local_day

    if not qr_ids:
        return {}
    last = local_today()
    first = last - timedelta(days=days - 1)
    start, end = bounds(first, last)
    day = local_day(ScanEvent.scanned_at)
    rows = session.execute(
        select(ScanEvent.qr_code_id, day, func.count())
        .where(ScanEvent.qr_code_id.in_(qr_ids), ScanEvent.is_bot.is_(False),
               ScanEvent.outcome == "ok", ScanEvent.scanned_at >= start,
               ScanEvent.scanned_at < end)
        .group_by(ScanEvent.qr_code_id, day)
    ).all()  # fmt: skip
    out = {qr_id: [0] * days for qr_id in qr_ids}
    for qr_id, d, count in rows:
        out[qr_id][(d - first).days] = count
    return out


def qr_out(qr: QrCode, scan_count: int = 0) -> QrOut:
    return QrOut(
        id=qr.id, name=qr.name, kind=qr.kind, qr_type=qr.qr_type, destination=qr.destination,
        content_type=qr.content_type, target_url=qr.target_url, static_data=qr.static_data,
        slug=qr.slug, short_url=short_link(qr.slug) if qr.slug else None, status=qr.status,
        root_url=root_link(qr.slug) if qr.slug else None,
        fg_color=qr.fg_color, bg_color=qr.bg_color, margin=qr.margin,
        error_correction=qr.error_correction, design=qr.design, scan_count=scan_count,
        created_at=qr.created_at, updated_at=qr.updated_at, blocked_reason=qr.blocked_reason,
        has_qr=qr.has_qr, scan_total=qr.scan_total, folder_id=qr.folder_id,
    )  # fmt: skip


def get_owned(session: Session, ctx, qr_id: int, lock=False, edit=False) -> QrCode:
    """qr -> company -> workspace chain check (ctx comes from owned_company)."""
    query = select(QrCode).where(
        QrCode.id == qr_id,
        QrCode.company_id == ctx.company.id,
        QrCode.workspace_id == ctx.workspace.id,
        QrCode.deleted_at.is_(None),
    )
    if lock:
        query = query.with_for_update()
    qr = session.scalar(query)
    if qr is None:
        raise HTTPException(404, "Codice QR non trovato.")
    if edit:  # 0.5: above the plan limits an element is read-only (never switched off)
        from ..limits import ensure_editable

        ensure_editable(session, ctx.workspace, qr)
    return qr


def require_dynamic(qr: QrCode) -> None:
    if qr.kind != "dynamic":
        raise HTTPException(409, "Operazione disponibile solo per i QR dinamici.")


def kind_of(qr_type: str, dynamic: bool) -> tuple[str, str]:
    """(kind, destination) for a type."""
    if qr_type in PAGE_TYPES:
        return "dynamic", "page"
    if qr_type in STATIC_TYPES:
        return "static", "redirect"
    return ("dynamic", "redirect") if dynamic else ("static", "redirect")


def invalid(message: str, field: str) -> CodedError:
    error = CodedError(422, message, "invalid_content")
    error.field = field  # type: ignore[attr-defined]
    return error


def validate_static(qr_type: str, data: dict | None) -> dict:
    try:
        return STATIC_SCHEMAS[qr_type].model_validate(data or {}).model_dump()
    except ValidationError as exc:
        first = exc.errors()[0]
        raise invalid(str(first["msg"]).removeprefix("Value error, "), "static_data") from None


def check_page_files(session: Session, company_id: int, page: Page) -> None:
    """Every referenced file must be a live file of the same company, of the right kind."""
    ids = page.file_ids()
    if not ids:
        return
    files = {f.id: f for f in session.scalars(select(StoredFile).where(
        StoredFile.id.in_(ids), StoredFile.company_id == company_id,
        StoredFile.deleted_at.is_(None)))}  # fmt: skip
    missing = ids - set(files)
    if missing:
        raise invalid("Uno o più file non sono disponibili: caricali di nuovo.", "page")
    for block in page.blocks:
        if block.type == "audio_player" and any(
            files[t.file_id].kind != "audio" for t in block.tracks
        ):
            raise invalid("Le tracce devono essere file audio.", "page")
        if block.type == "file" and files[block.file_id].kind != "pdf":
            raise invalid("Il blocco file accetta solo PDF.", "page")


def resolve_content(session: Session, ctx, qr_type: str, kind: str, content: QrContent):
    """Validates the type-specific content and checks every destination URL against the
    blocklist and the reputation provider. Returns (target_url, static_data, page)."""
    target_url, static_data, page = validate_content(session, ctx, qr_type, kind, content)
    from ..abuse.checks import check_destinations

    check_destinations(session, target_url, static_data,
                       page.model_dump(mode="json") if page else None)  # fmt: skip
    return target_url, static_data, page


def validate_content(session: Session, ctx, qr_type: str, kind: str, content: QrContent):
    if qr_type == "website" and kind == "dynamic":
        try:
            return valid_url(content.target_url), None, None
        except ValueError as exc:
            raise invalid(str(exc), "target_url") from None
    if kind == "static":
        data = content.static_data
        if qr_type == "website" and not data and content.target_url:
            data = {"url": content.target_url}
        data = validate_static(qr_type, data)
        return (data["url"] if qr_type == "website" else ""), data, None
    if content.page is None:
        raise invalid("Compila il contenuto della pagina.", "page")
    if content.page.template != qr_type:
        raise invalid("Il modello della pagina non corrisponde al tipo di QR.", "page")
    check_page_files(session, ctx.company.id, content.page)
    return "", None, content.page


def save_page(session: Session, qr: QrCode, page: Page | None) -> None:
    if page is None:
        return
    row = session.get(QrPage, qr.id)
    document = page.model_dump(mode="json")
    if row is None:
        session.add(QrPage(qr_code_id=qr.id, template=page.template, document=document))
    else:
        row.document, row.template = document, page.template
    from ..storage.usage import link_files_to_qr

    link_files_to_qr(session, qr.id, page.file_ids())


STYLE_FIELDS = ("fg_color", "bg_color", "margin", "error_correction")


def gate_design(session: Session, ctx, qr: QrCode, payload: QrContent) -> None:
    """Applies the design and refuses to save a QR that does not decode."""
    from .design_service import apply_design, design_from_payload, render, require_scannable

    design = design_from_payload(payload)
    content = encoded_content_of(qr)
    require_scannable(content, design, render(session, ctx.company.id, content, design))
    apply_design(qr, design)


def insert_qr(session: Session, ctx, payload: QrCreate) -> QrCode:
    """Creates the QR (fresh unique slug for dynamic ones, retried on the rare collision)."""
    require_type(plan_of(session, ctx.workspace), payload.qr_type)
    kind, destination = kind_of(payload.qr_type, payload.dynamic)
    if kind == "static" and not payload.has_qr:
        raise invalid("Un QR statico esiste solo come QR.", "has_qr")
    target_url, static_data, page = resolve_content(session, ctx, payload.qr_type, kind, payload)
    style = {f: getattr(payload, f) for f in STYLE_FIELDS}
    for _ in range(SLUG_ATTEMPTS):
        qr = QrCode(
            workspace_id=ctx.workspace.id, company_id=ctx.company.id, status="active",
            name=payload.name, kind=kind, qr_type=payload.qr_type, destination=destination,
            target_url=target_url, static_data=static_data, has_qr=payload.has_qr, **style,
        )  # fmt: skip
        if kind == "dynamic":
            qr.slug = new_slug()
            from ..links.service import slug_taken_by_alias

            while slug_taken_by_alias(session, qr.slug):  # a back-half already uses it
                qr.slug = new_slug()
        savepoint = session.begin_nested()
        session.add(qr)
        try:
            savepoint.commit()
            gate_design(session, ctx, qr, payload)
            save_page(session, qr, page)
            if kind == "dynamic":
                from ..links.versions import record_version

                record_version(session, qr, ctx.user, "created")
            return qr
        except IntegrityError:
            savepoint.rollback()
            if kind != "dynamic":
                raise
    raise HTTPException(503, "Impossibile generare un link univoco. Riprova.")


def update_content(session: Session, ctx, qr: QrCode, content: QrContent) -> bool:
    """Applies new content; returns True when a redirect destination changed."""
    target_url, static_data, page = resolve_content(session, ctx, qr.qr_type, qr.kind, content)
    changed = qr.destination == "redirect" and qr.kind == "dynamic" and target_url != qr.target_url
    qr.target_url, qr.static_data = target_url, static_data
    gate_design(session, ctx, qr, content)
    save_page(session, qr, page)
    return changed


def encoded_content_of(qr: QrCode) -> str:
    if qr.kind == "dynamic":
        return short_link(qr.slug)
    return encode_static(qr.qr_type, qr.static_data or {"url": qr.target_url})


def apply_content_change(
    session: Session, ctx, qr: QrCode, content: QrContent, change: str | None = None
) -> str | None:
    """Saves new content (and a type change, for dynamic links) and records a version.

    Returns "type", "destination" or "content" for dynamic links, None for static ones."""
    from ..links.versions import apply_type, check_type_change, record_version

    new_type = getattr(content, "qr_type", None)
    type_changed = bool(new_type and new_type != qr.qr_type)
    if type_changed:
        _, destination = check_type_change(session, ctx.workspace, qr, new_type)
        apply_type(session, qr, new_type, destination)
    changed = update_content(session, ctx, qr, content)
    if qr.kind != "dynamic":
        return None
    kind = change or ("type" if type_changed else "destination" if changed else "content")
    record_version(session, qr, ctx.user, kind)
    return kind
