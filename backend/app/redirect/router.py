"""Public short links: GET /r/{slug} -> 302 to the current destination.

One indexed query (qr_codes JOIN companies JOIN workspaces) decides the outcome. Only manual
suspension of the workspace blocks redirects; an expired trial does not. The scan is written by a
background task after the response has been sent, so it never slows the redirect.
"""

import logging
import re
from urllib.parse import urlsplit

from fastapi import APIRouter, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy import select

from ..access import redirects_enabled
from ..auth.service import client_ip
from ..core.database import session_factory
from ..models import Company, QrCode, ScanEvent, Workspace
from ..qr.render import SLUG_LENGTH
from ..stats.geo import lookup
from ..stats.periods import local_today
from ..stats.visitors import salt_for, visitor_hash
from .pages import INACTIVE_HTML
from .useragent import classify

logger = logging.getLogger(__name__)
router = APIRouter(tags=["redirect"])
SLUG = re.compile(rf"^[A-Za-z0-9]{{{SLUG_LENGTH}}}$")
HEADERS = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}


def record_scan(qr_id: int, user_agent: str, referrer: str, ip: str = "unknown") -> None:
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
                    country_code=country,
                    city=city,
                    visitor_hash=hashed,
                )
            )
            session.commit()
    except Exception as exc:  # noqa: BLE001 - analytics must never affect redirects
        logger.warning("Scan not recorded (%s)", type(exc).__name__)


def inactive(status_code: int) -> HTMLResponse:
    return HTMLResponse(INACTIVE_HTML, status_code=status_code, headers=HEADERS)


@router.api_route("/r/{slug}", methods=["GET", "HEAD"], include_in_schema=False)
def follow(slug: str, request: Request, tasks: BackgroundTasks):
    if not SLUG.match(slug):
        return inactive(404)
    with session_factory()() as session:
        row = session.execute(
            select(
                QrCode.id,
                QrCode.target_url,
                QrCode.status,
                QrCode.deleted_at,
                QrCode.destination,
                Company.deleted_at.label("company_deleted_at"),
                Workspace.status.label("workspace_status"),
            )
            .join(Company, Company.id == QrCode.company_id)
            .join(Workspace, Workspace.id == Company.workspace_id)
            .where(QrCode.slug == slug)
        ).one_or_none()
    if row is None:
        return inactive(404)
    if (
        row.deleted_at
        or row.company_deleted_at
        or row.status != "active"
        or not redirects_enabled(row.workspace_status)
    ):
        return inactive(410)
    if request.method == "GET":
        tasks.add_task(
            record_scan,
            row.id,
            request.headers.get("user-agent", ""),
            request.headers.get("referer", ""),
            client_ip(request),
        )
    if row.destination == "page":
        # The hosted page is rendered by the frontend on the same URL (no extra hop).
        return Response(status_code=200, headers={**HEADERS, "X-Vorya-Destination": "page"})
    return RedirectResponse(row.target_url, status_code=302, headers=HEADERS)
