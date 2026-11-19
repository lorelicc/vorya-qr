from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import QrCode, ScanEvent
from ..schemas.qr import QrCreate, QrOut
from .render import new_slug, short_link

SLUG_ATTEMPTS = 8


def scan_counts(session: Session, qr_ids: list[int]) -> dict[int, int]:
    if not qr_ids:
        return {}
    rows = session.execute(
        select(ScanEvent.qr_code_id, func.count())
        .where(ScanEvent.qr_code_id.in_(qr_ids), ScanEvent.is_bot.is_(False))
        .group_by(ScanEvent.qr_code_id)
    ).all()
    return dict(rows)


def qr_out(qr: QrCode, scan_count: int = 0) -> QrOut:
    return QrOut(
        id=qr.id,
        name=qr.name,
        kind=qr.kind,
        content_type=qr.content_type,
        target_url=qr.target_url,
        slug=qr.slug,
        short_url=short_link(qr.slug) if qr.slug else None,
        status=qr.status,
        fg_color=qr.fg_color,
        bg_color=qr.bg_color,
        margin=qr.margin,
        error_correction=qr.error_correction,
        scan_count=scan_count,
        created_at=qr.created_at,
        updated_at=qr.updated_at,
    )


def get_owned(session: Session, workspace_id: int, qr_id: int, lock=False) -> QrCode:
    query = select(QrCode).where(
        QrCode.id == qr_id, QrCode.workspace_id == workspace_id, QrCode.deleted_at.is_(None)
    )
    if lock:
        query = query.with_for_update()
    qr = session.scalar(query)
    if qr is None:
        raise HTTPException(404, "Codice QR non trovato.")
    return qr


def require_dynamic(qr: QrCode) -> None:
    if qr.kind != "dynamic":
        raise HTTPException(409, "Operazione disponibile solo per i QR dinamici.")


def insert_qr(session: Session, workspace_id: int, payload: QrCreate) -> QrCode:
    """Inserts with a fresh unique slug for dynamic QR, retrying on the rare collision."""
    data = payload.model_dump()
    for _ in range(SLUG_ATTEMPTS):
        qr = QrCode(workspace_id=workspace_id, status="active", **data)
        if payload.kind == "dynamic":
            qr.slug = new_slug()
        savepoint = session.begin_nested()
        session.add(qr)
        try:
            savepoint.commit()
            return qr
        except IntegrityError:
            savepoint.rollback()
            if payload.kind != "dynamic":
                raise
    raise HTTPException(503, "Impossibile generare un link univoco. Riprova.")
