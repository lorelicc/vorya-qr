"""Periodic maintenance: `python -m app.worker` (compose `worker` service).

A PostgreSQL advisory lock makes sure only one worker runs the jobs even with replicas.
Each job is idempotent and commits on its own.
"""

import logging
import time
from collections.abc import Callable

from sqlalchemy import delete, select, text, update
from sqlalchemy.orm import Session

from .core.database import session_factory
from .core.security import now
from .models import AuthSession, Company, CompanyTransfer, PasswordReset, QrCode, ScanEvent

log = logging.getLogger("vorya_qr.worker")
WORKER_LOCK = 71830202
INTERVAL_SECONDS = 300
JOBS: list[Callable[[Session], int]] = []


def job(fn: Callable[[Session], int]) -> Callable[[Session], int]:
    JOBS.append(fn)
    return fn


@job
def expire_transfers(session: Session) -> int:
    result = session.execute(
        update(CompanyTransfer)
        .where(CompanyTransfer.status == "pending", CompanyTransfer.expires_at <= now())
        .values(status="expired", decided_at=now())
    )
    return result.rowcount


@job
def purge_companies(session: Session) -> int:
    """After 30 days a deleted company loses its content. QR rows stay as tombstones so a
    slug can never be handed to someone else; they keep showing 'QR non attivo'."""
    companies = list(
        session.scalars(
            select(Company)
            .where(
                Company.status == "active",
                Company.deleted_at.is_not(None),
                Company.purge_after <= now(),
            )
            .with_for_update(skip_locked=True)
            .limit(50)
        )
    )
    for company in companies:
        qr_ids = select(QrCode.id).where(QrCode.company_id == company.id)
        session.execute(delete(ScanEvent).where(ScanEvent.qr_code_id.in_(qr_ids)))
        session.execute(
            update(QrCode)
            .where(QrCode.company_id == company.id)
            .values(target_url="", deleted_at=now(), name="QR eliminato")
        )
        from .storage.usage import purge_company_files

        purge_company_files(session, company.id)
        company.status, company.name, company.logo_file_id = "purged", "Azienda eliminata", None
    return len(companies)


@job
def cleanup_tokens(session: Session) -> int:
    a = session.execute(delete(AuthSession).where(AuthSession.expires_at <= now())).rowcount
    b = session.execute(delete(PasswordReset).where(PasswordReset.expires_at <= now())).rowcount
    return a + b


def run_once() -> dict[str, int]:
    results: dict[str, int] = {}
    with session_factory()() as session:
        if not session.execute(
            text("SELECT pg_try_advisory_lock(:k)"), {"k": WORKER_LOCK}
        ).scalar():
            return results
        try:
            for fn in JOBS:
                try:
                    results[fn.__name__] = fn(session)
                    session.commit()
                except Exception as exc:  # noqa: BLE001 - one failing job must not stop the others
                    session.rollback()
                    log.warning("Job %s failed (%s)", fn.__name__, type(exc).__name__)
        finally:
            session.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": WORKER_LOCK})
            session.commit()
    return results


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    log.info("Vorya QR worker avviato (ogni %ss)", INTERVAL_SECONDS)
    while True:
        log.info("Esecuzione job: %s", run_once())
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
