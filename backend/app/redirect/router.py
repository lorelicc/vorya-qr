"""Public short links: GET /r/{slug-or-alias} (and /{slug-or-alias} via the frontend) -> 302.

One indexed query (qr_codes JOIN companies JOIN workspaces, with the alias lookup as a scalar
subquery) decides the outcome; 0.3 rules (expiry, password, schedule) are read from the same row.
The slug wins over an alias (slugs are case-sensitive, aliases lower-case). The scan is written
by a background task after the response has been sent, so it never slows the redirect.
"""

import logging
import re
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy import func, select, update

from ..access import redirects_enabled
from ..auth.service import client_ip
from ..core.database import session_factory
from ..core.security import now
from ..links.service import cookie_name, is_expired, scheduled_url, unlocked
from ..models import Company, LinkAlias, QrCode, ScanEvent, Workspace
from ..stats.geo import lookup
from ..stats.periods import local_today
from ..stats.visitors import salt_for, visitor_hash
from .pages import EXPIRED_HTML, INACTIVE_HTML
from .useragent import classify

logger = logging.getLogger(__name__)
router = APIRouter(tags=["redirect"])
# 7-char slugs and 3-50 char back-halves ([a-z0-9-], matched case-insensitively).
SLUG = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{1,48})[A-Za-z0-9]$")
HEADERS = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}


def record_scan(
    qr_id: int, user_agent: str, referrer: str, ip: str = "unknown", outcome: str = "ok"
) -> None:
    """The IP is used in memory for the place and the daily hash, then discarded."""
    try:
        info = classify(user_agent)
        host = urlsplit(referrer).hostname if referrer else None
        country, city = (None, None) if info.is_bot else lookup(ip)
        with session_factory()() as session:
            hashed = None
            if not info.is_bot and ip != "unknown":
                hashed = visitor_hash(salt_for(session, local_today()), ip, user_agent)
            session.add(
                ScanEvent(
                    qr_code_id=qr_id,
                    device_type=info.device_type,
                    os=info.os,
                    browser=info.browser,
                    referrer_host=host[:255] if host else None,
                    is_bot=info.is_bot,
                    outcome=outcome,
                    country_code=country,
                    city=city,
                    visitor_hash=hashed,
                )
            )
            if not info.is_bot and outcome == "ok":  # 0.3: "expires after N scans"
                session.execute(
                    update(QrCode)
                    .where(QrCode.id == qr_id)
                    .values(scan_total=QrCode.scan_total + 1)
                )
            session.commit()
    except Exception as exc:  # noqa: BLE001 - analytics must never affect redirects
        logger.warning("Scan not recorded (%s)", type(exc).__name__)


def inactive(status_code: int) -> HTMLResponse:
    return HTMLResponse(INACTIVE_HTML, status_code=status_code, headers=HEADERS)


def resolve(session, slug: str):
    target = func.coalesce(
        select(QrCode.id).where(QrCode.slug == slug).scalar_subquery(),
        select(LinkAlias.qr_code_id)
        .where(LinkAlias.alias == slug.lower(), LinkAlias.removed_at.is_(None))
        .scalar_subquery(),
    )
    return session.execute(
        select(
            QrCode.id, QrCode.target_url, QrCode.status, QrCode.deleted_at, QrCode.destination,
            QrCode.slug, QrCode.expires_at, QrCode.max_scans, QrCode.scan_total,
            QrCode.fallback_url, QrCode.password_hash, QrCode.schedule,
            Company.deleted_at.label("company_deleted_at"),
            Workspace.status.label("workspace_status"),
            Workspace.redirects_until,
        )
        .join(Company, Company.id == QrCode.company_id)
        .join(Workspace, Workspace.id == Company.workspace_id)
        .where(QrCode.id == target)
    ).one_or_none()  # fmt: skip


def expired_page() -> HTMLResponse:
    return HTMLResponse(EXPIRED_HTML, status_code=410, headers=HEADERS)


@router.api_route("/r/{slug}", methods=["GET", "HEAD"], include_in_schema=False)
def follow(slug: str, request: Request, tasks: BackgroundTasks):
    if not SLUG.match(slug):
        return inactive(404)
    with session_factory()() as session:
        row = resolve(session, slug)
        if row is None:
            return inactive(404)
        if (
            row.deleted_at
            or row.company_deleted_at
            or row.status != "active"
            or not redirects_enabled(row.workspace_status, row.redirects_until)
        ):
            return inactive(410)
        at = now()

        def scan(outcome: str = "ok") -> None:
            if request.method == "GET":
                tasks.add_task(
                    record_scan,
                    row.id,
                    request.headers.get("user-agent", ""),
                    request.headers.get("referer", ""),
                    client_ip(request),
                    outcome,
                )

        if is_expired(row, at):
            scan("expired")
            if row.fallback_url:
                return RedirectResponse(row.fallback_url, status_code=302, headers=HEADERS)
            return expired_page()
        if row.password_hash and not unlocked(
            session, row.id, row.password_hash, request.cookies.get(cookie_name(row.id))
        ):
            scan("password")
            # The frontend renders the branded password form on the same URL.
            return Response(
                status_code=200,
                headers={**HEADERS, "X-Vorya-Destination": "password", "X-Vorya-Slug": row.slug},
            )
    scan()
    scheduled = scheduled_url(row.schedule, at)
    if scheduled:
        return RedirectResponse(scheduled, status_code=302, headers=HEADERS)
    if row.destination == "page":
        # The hosted page is rendered by the frontend on the same URL (no extra hop).
        return Response(
            status_code=200,
            headers={**HEADERS, "X-Vorya-Destination": "page", "X-Vorya-Slug": row.slug},
        )
    return RedirectResponse(row.target_url, status_code=302, headers=HEADERS)
