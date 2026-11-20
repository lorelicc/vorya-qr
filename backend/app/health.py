"""Detailed health (protected): DB, migrations, storage, SMTP, worker, for an external monitor."""

import secrets
import time
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Header, HTTPException
from sqlalchemy import func, select, text

from . import __version__
from .core.config import get_settings
from .core.database import get_engine, session_factory
from .core.security import now
from .mail.check import smtp_status
from .models import BillingMail, ImportJob, PlatformSetting, ReportLog
from .storage.backends import get_storage

router = APIRouter(tags=["system"])
WORKER_KEY = "worker"


def beat() -> None:
    """Worker heartbeat (called by the worker every ~30 s)."""
    with session_factory()() as session:
        row = session.get(PlatformSetting, WORKER_KEY) or PlatformSetting(key=WORKER_KEY, data={})
        row.data = {"at": now().isoformat()}
        session.merge(row)
        session.commit()


def check_storage() -> dict:
    key = f"files/{uuid.uuid4()}/health"  # a real storage key, written and deleted at once
    try:
        storage = get_storage()
        storage.put(key, b"ok", "text/plain")
        ok = b"".join(storage.read(key)) == b"ok"
        storage.delete(key)
        return {"ok": ok, "driver": get_settings().storage_driver}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "driver": get_settings().storage_driver, "error": type(exc).__name__}


@router.get("/health/detail", include_in_schema=False)
def detail(x_health_token: str = Header(default="")):
    token = get_settings().health_token.get_secret_value()
    if not token:
        raise HTTPException(404, "Non disponibile.")
    if not secrets.compare_digest(x_health_token, token):
        raise HTTPException(403, "Token non valido.")
    started = time.monotonic()
    out: dict = {"version": __version__}
    try:
        with get_engine().connect() as c:
            c.execute(text("SELECT 1"))
            head = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
        out["database"] = {"ok": True, "migration": head}
        with session_factory()() as session:
            heart = session.get(PlatformSetting, WORKER_KEY)
            age = (
                (now() - datetime.fromisoformat(heart.data["at"])).total_seconds()
                if heart and heart.data.get("at")
                else None
            )
            out["worker"] = {"ok": age is not None and age < 180, "seconds_since_heartbeat": age}
            out["queues"] = {
                "mail_pending": session.scalar(
                    select(func.count()).where(BillingMail.state == "pending")
                ),
                "imports_queued": session.scalar(
                    select(func.count()).where(ImportJob.status == "queued")
                ),
                "reports_due": session.scalar(
                    select(func.count()).where(
                        ReportLog.state == "pending",
                        ReportLog.due_at <= now() + timedelta(seconds=1),
                    )
                ),
            }
    except Exception as exc:  # noqa: BLE001
        out["database"] = {"ok": False, "error": type(exc).__name__}
    out["storage"] = check_storage()
    out["smtp"] = smtp_status()
    out["ok"] = all(
        out.get(k, {}).get("ok", False) for k in ("database", "storage", "smtp", "worker")
    )
    out["took_ms"] = round((time.monotonic() - started) * 1000)
    return out
