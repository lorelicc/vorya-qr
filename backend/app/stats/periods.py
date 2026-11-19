"""Date ranges for statistics, always in the Europe/Rome calendar."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from ..core.errors import CodedError
from ..core.security import now

TIMEZONE = "Europe/Rome"
TZ = ZoneInfo(TIMEZONE)
PRESETS = {"7d": 7, "30d": 30, "90d": 90}
MAX_DAYS = 366


def local_today() -> date:
    return now().astimezone(TZ).date()


def resolve(range_: str, start: date | None, end: date | None, retention_days: int | None):
    """-> (first day, last day) inclusive. Custom ranges are clamped to the plan retention."""
    today = local_today()
    if range_ == "custom":
        if not start or not end or start > end:
            raise CodedError(422, "Intervallo di date non valido.", "invalid_range")
        first, last = start, min(end, today)
    else:
        if range_ not in PRESETS:
            raise CodedError(422, "Intervallo non supportato.", "invalid_range")
        first, last = today - timedelta(days=PRESETS[range_] - 1), today
    if (last - first).days + 1 > MAX_DAYS:
        first = last - timedelta(days=MAX_DAYS - 1)
    if retention_days is not None:
        first = max(first, today - timedelta(days=retention_days - 1))
    if first > last:
        first = last
    return first, last


def bounds(first: date, last: date) -> tuple[datetime, datetime]:
    """UTC instants covering the local days [first, last]."""
    start = datetime.combine(first, time.min, TZ).astimezone(UTC)
    end = datetime.combine(last + timedelta(days=1), time.min, TZ).astimezone(UTC)
    return start, end


def days(first: date, last: date) -> list[date]:
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]
