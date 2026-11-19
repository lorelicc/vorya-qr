"""Per-QR scan statistics. Counts are "scansioni" (scans): without IPs there are no unique
visitors. Bot and link-preview requests are excluded from every figure except `bot_scans`."""

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..core.database import get_session
from ..core.security import now
from ..models import ScanEvent
from ..qr.service import get_owned, require_dynamic

router = APIRouter(prefix="/api/companies/{company_id}/qr-codes", tags=["stats"])
TIMEZONE = "Europe/Rome"
DAYS = 30
DEVICE_LABELS = {
    "mobile": "Smartphone",
    "tablet": "Tablet",
    "desktop": "Computer",
    "other": "Altro",
}


def _breakdown(session: Session, column, qr_id: int, limit: int = 6) -> list[dict]:
    rows = session.execute(
        select(column, func.count())
        .where(ScanEvent.qr_code_id == qr_id, ScanEvent.is_bot.is_(False))
        .group_by(column)
        .order_by(func.count().desc())
    ).all()
    top = [{"label": label, "count": count} for label, count in rows[:limit]]
    rest = sum(count for _, count in rows[limit:])
    if rest:
        top.append({"label": "Altro", "count": rest})
    return top


@router.get("/{qr_id}/stats")
def qr_stats(
    qr_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    require_dynamic(qr)
    human = (ScanEvent.qr_code_id == qr.id, ScanEvent.is_bot.is_(False))
    total, last = session.execute(
        select(func.count(), func.max(ScanEvent.scanned_at)).where(*human)
    ).one()
    bots = session.scalar(
        select(func.count()).where(ScanEvent.qr_code_id == qr.id, ScanEvent.is_bot.is_(True))
    )
    today = now().astimezone(ZoneInfo(TIMEZONE)).date()
    first = today - timedelta(days=DAYS - 1)
    local_day = cast(func.timezone(TIMEZONE, ScanEvent.scanned_at), Date)
    rows = session.execute(
        select(local_day, func.count()).where(*human, local_day >= first).group_by(local_day)
    ).all()
    per_day: dict[date, int] = dict(rows)
    daily = [
        {
            "date": (first + timedelta(days=i)).isoformat(),
            "count": per_day.get(first + timedelta(days=i), 0),
        }
        for i in range(DAYS)
    ]
    devices = _breakdown(session, ScanEvent.device_type, qr.id)
    for item in devices:
        item["label"] = DEVICE_LABELS.get(item["label"], item["label"])
    return {
        "total_scans": total,
        "bot_scans": bots,
        "last_scan_at": last,
        "scans_last_30_days": sum(day["count"] for day in daily),
        "timezone": TIMEZONE,
        "daily": daily,
        "devices": devices,
        "os": _breakdown(session, ScanEvent.os, qr.id),
        "browsers": _breakdown(session, ScanEvent.browser, qr.id),
    }
