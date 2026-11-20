"""Periodic maintenance: `python -m app.worker` (compose `worker` service).

A PostgreSQL advisory lock makes sure only one worker runs the jobs even with replicas.
Each job is idempotent and commits on its own.
"""

import logging
import time
from collections.abc import Callable

from sqlalchemy import delete, select, text, update
from sqlalchemy.orm import Session

from .core.database import get_engine, session_factory
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
def purge_files(session: Session) -> int:
    """Deletes the bytes of files removed 30+ days ago (and of QR codes deleted 30+ days ago)."""
    from .models import StoredFile
    from .storage.backends import get_storage
    from .storage.usage import mark_files_of_deleted_qr

    mark_files_of_deleted_qr(session)
    files = list(
        session.scalars(
            select(StoredFile)
            .where(
                StoredFile.deleted_at.is_not(None),
                StoredFile.purge_after <= now(),
                StoredFile.purged_at.is_(None),
            )
            .with_for_update(skip_locked=True)
            .limit(200)
        )
    )
    storage = get_storage()
    for file in files:
        for variant in file.variants.values():
            storage.delete(variant["key"])
        file.purged_at = now()
    return len(files)


@job
def rotate_salts(session: Session) -> int:
    """Yesterday's salt is destroyed: its visitor hashes become unlinkable forever."""
    from .stats.periods import local_today
    from .stats.visitors import drop_old_salts

    return drop_old_salts(session, local_today())


@job
def stats_retention(session: Session) -> int:
    """Deletes scans and clicks older than max(plan retention, 12 months)."""
    from datetime import timedelta

    from .models import PageEvent, Plan, Workspace
    from .plans import features_of

    removed = 0
    for plan in session.scalars(select(Plan)):
        days = features_of(plan).stats_retention_days
        if days is None:
            continue
        # 0.5: older than the plan window = hidden, not deleted; data is kept for at least 12
        # months so that an upgrade finds it again.
        cutoff = now() - timedelta(days=max(days, 365) + 1)  # one day of slack for time zones
        qr_ids = (
            select(QrCode.id)
            .join(Workspace, Workspace.id == QrCode.workspace_id)
            .where(Workspace.plan_id == plan.id)
        )
        removed += session.execute(
            delete(ScanEvent).where(ScanEvent.qr_code_id.in_(qr_ids), ScanEvent.scanned_at < cutoff)
        ).rowcount
        removed += session.execute(
            delete(PageEvent).where(PageEvent.qr_code_id.in_(qr_ids), PageEvent.created_at < cutoff)
        ).rowcount
    return removed


@job
def prune_versions(session: Session) -> int:
    """Keeps the last 20 versions per link; files only they used are removed."""
    from .links.versions import prune

    return prune(session)


@job
def release_aliases(session: Session) -> int:
    """Aliases removed 90+ days ago are free for anyone again: drop the quarantine rows."""
    from datetime import timedelta

    from .models import LinkAlias

    cutoff = now() - timedelta(days=90)
    return session.execute(
        delete(LinkAlias).where(LinkAlias.removed_at.is_not(None), LinkAlias.removed_at <= cutoff)
    ).rowcount


@job
def cleanup_tokens(session: Session) -> int:
    a = session.execute(delete(AuthSession).where(AuthSession.expires_at <= now())).rowcount
    b = session.execute(delete(PasswordReset).where(PasswordReset.expires_at <= now())).rowcount
    return a + b


def run_queue(session: Session) -> int:
    """Short-interval work: billing emails, then one import ZIP per tick."""
    import uuid

    from .billing.mail import send_pending
    from .imports.service import build_zip
    from .models import ImportJob
    from .storage.backends import get_storage

    mails = send_pending(session)  # payment emails go out within seconds, not minutes
    session.commit()
    from .reports.service import send_due

    mails += send_due(session)  # reports: queued with a spread due time, a few per tick
    session.commit()

    job = session.scalar(
        select(ImportJob)
        .where(ImportJob.status == "queued")
        .order_by(ImportJob.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if job is None:
        return mails
    job.status, job.processed = "running", 0
    session.commit()

    def progress(done: int) -> None:
        job.processed = done
        session.commit()

    try:
        data = build_zip(session, job, progress)
        key = f"files/{uuid.uuid4()}/import"
        get_storage().put(key, data, "application/zip")
        job.result_key, job.status, job.finished_at, job.error = key, "done", now(), None
    except Exception as exc:  # noqa: BLE001 - reported to the user, who can retry
        session.rollback()
        job = session.get(ImportJob, job.id)
        job.status, job.error = (
            "failed",
            f"Generazione dello ZIP non riuscita ({type(exc).__name__}).",
        )
        log.warning("Import %s failed (%s)", job.id, type(exc).__name__)
    session.commit()
    return 1


@job
def purge_import_results(session: Session) -> int:
    """Result ZIPs are kept 7 days: they can be downloaded again meanwhile."""
    from datetime import timedelta

    from .models import ImportJob
    from .storage.backends import get_storage

    old = session.scalars(
        select(ImportJob).where(
            ImportJob.result_key.is_not(None), ImportJob.finished_at <= now() - timedelta(days=7)
        )
    ).all()
    for row in old:
        get_storage().delete(row.result_key)
        row.result_key = None
    return len(old)


def compute_metrics(session: Session) -> int:
    """Admin metrics snapshot, at most once an hour (the heavy queries never run on request)."""
    from datetime import timedelta

    from .metrics import latest, snapshot

    last = latest(session)
    if last is not None and last.created_at > now() - timedelta(hours=1):
        return 0
    snapshot(session)
    return 1


JOBS.append(compute_metrics)


def schedule_reports(session: Session) -> int:
    from .reports.service import schedule

    return schedule(session)


JOBS.append(schedule_reports)


def _billing_jobs() -> None:
    from .billing import jobs

    for fn in (
        jobs.expire_grants,
        jobs.trial_reminders,
        jobs.onboarding_emails,
        jobs.send_billing_mail,
        jobs.reconcile_subscriptions,
    ):
        job(fn)


_billing_jobs()


def run_once() -> dict[str, int]:
    """Runs every job once. The advisory lock lives on its own connection: a Session may
    switch pooled connections between commits, which would leave a session lock dangling."""
    results: dict[str, int] = {}
    with get_engine().connect() as lock:
        if not lock.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": WORKER_LOCK}).scalar():
            return results
        try:
            with session_factory()() as session:
                for fn in JOBS:
                    try:
                        results[fn.__name__] = fn(session)
                        session.commit()
                    except Exception as exc:  # noqa: BLE001 - one failing job must not stop others
                        session.rollback()
                        log.warning("Job %s failed (%s)", fn.__name__, type(exc).__name__)
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": WORKER_LOCK})
            lock.commit()
    return results


QUEUE_SECONDS = 2


def run_queue_once() -> int:
    """Drains the fast queue (own advisory lock: it never waits for the slow maintenance)."""
    with get_engine().connect() as lock:
        if not lock.execute(
            text("SELECT pg_try_advisory_lock(:k)"), {"k": WORKER_LOCK + 1}
        ).scalar():
            return 0
        try:
            with session_factory()() as session:
                return run_queue(session)
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": WORKER_LOCK + 1})
            lock.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    log.info("Vorya QR worker avviato (coda ogni %ss, manutenzione ogni %ss)", QUEUE_SECONDS,
             INTERVAL_SECONDS)  # fmt: skip
    next_maintenance = 0.0
    while True:
        try:
            if time.monotonic() >= next_maintenance:
                log.info("Esecuzione job: %s", run_once())
                next_maintenance = time.monotonic() + INTERVAL_SECONDS
            busy = run_queue_once()
        except Exception as exc:  # noqa: BLE001 - e.g. database still migrating: keep running
            log.warning("Worker in attesa (%s)", type(exc).__name__)
            busy = 0
        if not busy:
            time.sleep(QUEUE_SECONDS)


if __name__ == "__main__":
    main()
