"""Aggregations shared by the per-QR and per-company statistics."""

from datetime import date

from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from ..models import PageEvent, QrCode, ScanEvent
from .periods import TIMEZONE, bounds, days

DEVICE_LABELS = {
    "mobile": "Smartphone",
    "tablet": "Tablet",
    "desktop": "Computer",
    "other": "Altro",
}
TOP = 8


def local_day(column):
    return cast(func.timezone(TIMEZONE, column), Date)


class Scope:
    """Which scans are counted: one QR, or all QR codes of a company."""

    def __init__(self, first: date, last: date, qr_id: int | None = None, company_id=None):
        self.first, self.last = first, last
        self.start, self.end = bounds(first, last)
        self.qr_id, self.company_id = qr_id, company_id

    def scans(self, *extra, bots=False, blocked=False):
        where = [ScanEvent.scanned_at >= self.start, ScanEvent.scanned_at < self.end,
                 ScanEvent.is_bot.is_(bots), *extra]  # fmt: skip
        if not bots and not blocked:  # 0.3: scans stopped by a password/expiry are apart
            where.append(ScanEvent.outcome == "ok")
        elif blocked:
            where.append(ScanEvent.outcome != "ok")
        if self.qr_id is not None:
            where.append(ScanEvent.qr_code_id == self.qr_id)
        else:
            where.append(
                ScanEvent.qr_code_id.in_(
                    select(QrCode.id).where(QrCode.company_id == self.company_id)
                )
            )
        return where

    def clicks(self):
        where = [PageEvent.created_at >= self.start, PageEvent.created_at < self.end]
        if self.qr_id is not None:
            where.append(PageEvent.qr_code_id == self.qr_id)
        else:
            where.append(
                PageEvent.qr_code_id.in_(
                    select(QrCode.id).where(QrCode.company_id == self.company_id)
                )
            )
        return where


def series(session: Session, scope: Scope) -> list[dict]:
    day = local_day(ScanEvent.scanned_at)
    rows = session.execute(
        select(day, func.count(), func.count(func.distinct(ScanEvent.visitor_hash)))
        .where(*scope.scans())
        .group_by(day)
    ).all()
    found = {d: (scans, unique) for d, scans, unique in rows}
    click_day = local_day(PageEvent.created_at)
    clicks = dict(
        session.execute(
            select(click_day, func.count()).where(*scope.clicks()).group_by(click_day)
        ).all()
    )
    out = []
    for d in days(scope.first, scope.last):
        scans, unique = found.get(d, (0, 0))
        out.append({"date": d.isoformat(), "count": scans, "unique": unique,
                    "clicks": clicks.get(d, 0)})  # fmt: skip
    return out


def breakdown(session: Session, scope: Scope, column, labels=None, limit=TOP) -> list[dict]:
    rows = session.execute(
        select(column, func.count())
        .where(*scope.scans(), column.is_not(None))
        .group_by(column)
        .order_by(func.count().desc(), column)
    ).all()
    top = [{"label": (labels or {}).get(v, v), "key": v, "count": c} for v, c in rows[:limit]]
    rest = sum(c for _, c in rows[limit:])
    if rest:
        top.append({"label": "Altro", "key": None, "count": rest})
    return top


def cities(session: Session, scope: Scope) -> list[dict]:
    rows = session.execute(
        select(ScanEvent.city, ScanEvent.country_code, func.count())
        .where(*scope.scans(), ScanEvent.city.is_not(None))
        .group_by(ScanEvent.city, ScanEvent.country_code)
        .order_by(func.count().desc(), ScanEvent.city)
        .limit(TOP)
    ).all()
    return [{"label": city, "country": cc, "count": c} for city, cc, c in rows]


def top_clicks(session: Session, scope: Scope) -> list[dict]:
    rows = session.execute(
        select(PageEvent.label, func.count())
        .where(*scope.clicks())
        .group_by(PageEvent.label)
        .order_by(func.count().desc(), PageEvent.label)
        .limit(TOP)
    ).all()
    return [{"label": label, "count": c} for label, c in rows]


def summary(session: Session, scope: Scope) -> dict:
    daily = series(session, scope)
    bots = session.scalar(select(func.count()).where(*scope.scans(bots=True)))
    blocked = session.scalar(select(func.count()).where(*scope.scans(blocked=True)))
    return {
        "range": {
            "first": scope.first.isoformat(),
            "last": scope.last.isoformat(),
            "timezone": TIMEZONE,
        },  # fmt: skip
        "scans": sum(d["count"] for d in daily),
        # Sum of daily unique visitors: hashes cannot be linked across days by design.
        "unique_estimate": sum(d["unique"] for d in daily),
        "clicks": sum(d["clicks"] for d in daily),
        "bot_scans": bots,
        "blocked_scans": blocked,  # stopped by a password or an expired link
        "daily": daily,
        "devices": breakdown(session, scope, ScanEvent.device_type, DEVICE_LABELS),
        "os": breakdown(session, scope, ScanEvent.os),
        "browsers": breakdown(session, scope, ScanEvent.browser),
        "countries": breakdown(session, scope, ScanEvent.country_code),
        "cities": cities(session, scope),
        "top_clicks": top_clicks(session, scope),
    }
