"""Statistics for one QR and for a whole company.

Counts are "scansioni"; "visitatori unici" is a daily estimate from salted hashes that are
unlinkable after midnight. Bot and link-preview requests are excluded everywhere except
`bot_scans`. Places come from DB-IP Lite and are approximate."""

import csv
import io
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..core.database import get_session
from ..models import Plan, QrCode, ScanEvent
from ..plans import features_of
from ..qr.service import get_owned, require_dynamic
from . import geo
from .periods import resolve
from .queries import Scope, summary

router = APIRouter(prefix="/api/companies/{company_id}", tags=["stats"])
ATTRIBUTION = {"text": "IP Geolocation by DB-IP", "url": "https://db-ip.com"}
RangeName = Literal["7d", "30d", "90d", "custom"]


def _period(session: Session, ctx: CompanyContext, range_, start, end):
    retention = features_of(session.get(Plan, ctx.workspace.plan_id)).stats_retention_days
    return (*resolve(range_, start, end, retention), retention)


def _meta(retention):
    return {"retention_days": retention, "geo_available": geo.reader() is not None,
            "attribution": ATTRIBUTION}  # fmt: skip


@router.get("/qr-codes/{qr_id}/stats")
def qr_stats(
    qr_id: int,
    range: RangeName = "30d",  # noqa: A002 - public query parameter name
    start: date | None = None,
    end: date | None = None,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    require_dynamic(qr)
    first, last, retention = _period(session, ctx, range, start, end)
    data = summary(session, Scope(first, last, qr_id=qr.id))
    total, last_scan = session.execute(
        select(func.count(), func.max(ScanEvent.scanned_at)).where(
            ScanEvent.qr_code_id == qr.id, ScanEvent.is_bot.is_(False)
        )
    ).one()
    return {**data, **_meta(retention), "total_scans": total, "last_scan_at": last_scan,
            "scans_last_30_days": data["scans"] if range == "30d" else None}  # fmt: skip


@router.get("/stats")
def company_stats(
    range: RangeName = "30d",  # noqa: A002
    start: date | None = None,
    end: date | None = None,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    first, last, retention = _period(session, ctx, range, start, end)
    scope = Scope(first, last, company_id=ctx.company.id)
    data = summary(session, scope)
    rows = session.execute(
        select(QrCode.id, QrCode.name, QrCode.qr_type, func.count(ScanEvent.id))
        .join(ScanEvent, ScanEvent.qr_code_id == QrCode.id)
        .where(*scope.scans(), QrCode.deleted_at.is_(None))
        .group_by(QrCode.id)
        .order_by(func.count(ScanEvent.id).desc(), QrCode.id)
        .limit(10)
    ).all()
    top = [{"id": i, "name": n, "qr_type": t, "count": c} for i, n, t, c in rows]
    return {**data, **_meta(retention), "top_qr": top}


def _csv(rows: list[list], filename: str) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")  # Excel in Italian locale expects ";"
    for row in rows:
        writer.writerow(["'" + v if isinstance(v, str) and v[:1] in "=+-@\t\r" else v
                         for v in row])  # fmt: skip
    return Response(
        "﻿" + buffer.getvalue(),  # BOM: accents open correctly in Excel
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },  # fmt: skip
    )


def _daily_rows(data: dict) -> list[list]:
    rows = [["data", "scansioni", "visitatori_unici_stimati", "click"]]
    rows += [[d["date"], d["count"], d["unique"], d["clicks"]] for d in data["daily"]]
    return rows


@router.get("/qr-codes/{qr_id}/stats.csv")
def qr_stats_csv(
    qr_id: int,
    range: RangeName = Query("30d"),  # noqa: A002
    start: date | None = None,
    end: date | None = None,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    qr = get_owned(session, ctx, qr_id)
    require_dynamic(qr)
    first, last, _ = _period(session, ctx, range, start, end)
    data = summary(session, Scope(first, last, qr_id=qr.id))
    return _csv(_daily_rows(data), f"vorya-qr-{qr.slug}-{first}-{last}.csv")


@router.get("/stats.csv")
def company_stats_csv(
    range: RangeName = Query("30d"),  # noqa: A002
    start: date | None = None,
    end: date | None = None,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    first, last, _ = _period(session, ctx, range, start, end)
    data = summary(session, Scope(first, last, company_id=ctx.company.id))
    return _csv(_daily_rows(data), f"vorya-qr-azienda-{ctx.company.id}-{first}-{last}.csv")
