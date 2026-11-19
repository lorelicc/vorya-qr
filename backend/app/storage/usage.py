"""Storage accounting and lifecycle. Only live (not deleted) files count against the quota."""

from datetime import timedelta

from sqlalchemy import String, func, select, update
from sqlalchemy.orm import Session

from ..core.security import now
from ..models import QrCode, StoredFile

PURGE_DAYS = 30


def _live():
    return StoredFile.deleted_at.is_(None)


def storage_used(session: Session, workspace_id: int) -> int:
    return session.scalar(
        select(func.coalesce(func.sum(StoredFile.size_bytes), 0)).where(
            StoredFile.workspace_id == workspace_id, _live()
        )
    )


def company_storage(session: Session, company_id: int) -> int:
    return session.scalar(
        select(func.coalesce(func.sum(StoredFile.size_bytes), 0)).where(
            StoredFile.company_id == company_id, _live()
        )
    )


def move_company_files(session: Session, company_id: int, workspace_id: int) -> None:
    """Files are owned by the company; their denormalized workspace_id follows it."""
    session.execute(
        update(StoredFile)
        .where(StoredFile.company_id == company_id)
        .values(workspace_id=workspace_id)
    )


def soft_delete(session: Session, file: StoredFile) -> None:
    file.deleted_at = now()
    file.purge_after = now() + timedelta(days=PURGE_DAYS)


def purge_company_files(session: Session, company_id: int) -> None:
    session.execute(
        update(StoredFile)
        .where(StoredFile.company_id == company_id, StoredFile.purged_at.is_(None))
        .values(deleted_at=func.coalesce(StoredFile.deleted_at, now()), purge_after=now())
    )


def mark_files_of_deleted_qr(session: Session) -> None:
    """Files of QR codes deleted 30+ days ago are scheduled for removal, unless a live page
    (e.g. a duplicated QR) still references them."""
    from ..models import QrPage

    old_qr = select(QrCode.id).where(QrCode.deleted_at <= now() - timedelta(days=PURGE_DAYS))
    candidates = session.scalars(
        select(StoredFile).where(StoredFile.qr_code_id.in_(old_qr), StoredFile.deleted_at.is_(None))
    ).all()
    if not candidates:
        return
    live_docs = session.scalars(
        select(func.cast(QrPage.document, String))
        .join(QrCode, QrCode.id == QrPage.qr_code_id)
        .where(QrCode.deleted_at.is_(None))
    ).all()
    for file in candidates:
        if not any(file.id in doc for doc in live_docs):
            file.deleted_at, file.purge_after = now(), now()


def link_files_to_qr(session: Session, qr_id: int, file_ids: set[str]) -> None:
    """Remembers which QR uses a file, so its files can be purged 30 days after QR deletion."""
    if file_ids:
        session.execute(
            update(StoredFile).where(StoredFile.id.in_(file_ids)).values(qr_code_id=qr_id)
        )
