"""Periodic email reports for the customers of a company.

Built by the worker, never live: the period is computed in Europe/Rome, the sending is spread
over hours (`due_at`) so the SMTP is never flooded, every email carries a one-click unsubscribe.
"""

import html
import zoneinfo
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import now
from ..mail.mailer import send_email
from ..models import (
    Company,
    PageEvent,
    QrCode,
    ReportLog,
    ReportRecipient,
    ReportSettings,
    ScanEvent,
    Workspace,
)
from ..plans import features_of, plan_of

ROME = zoneinfo.ZoneInfo("Europe/Rome")
MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto",
          "settembre", "ottobre", "novembre", "dicembre"]  # fmt: skip
SPREAD_MINUTES = 180


def period_for(kind: str, at: datetime) -> tuple[datetime, datetime] | None:
    """The last COMPLETED period, once it is 07:00 Rome of its first day after; else None."""
    local = at.astimezone(ROME)
    if kind == "weekly":
        monday = (local - timedelta(days=local.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        if local < monday.replace(hour=7):
            monday -= timedelta(days=7)
        end = monday
        return (end - timedelta(days=7)).astimezone(UTC), end.astimezone(UTC)
    first = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if local < first.replace(hour=7):
        first = (first - timedelta(days=1)).replace(day=1)
    previous = (first - timedelta(days=1)).replace(day=1)
    return previous.astimezone(UTC), first.astimezone(UTC)


def label(kind: str, start: datetime, end: datetime) -> str:
    a, b = start.astimezone(ROME), (end - timedelta(seconds=1)).astimezone(ROME)
    if kind == "monthly":
        return f"{MONTHS[a.month - 1]} {a.year}"
    return f"dal {a.day} {MONTHS[a.month - 1]} al {b.day} {MONTHS[b.month - 1]} {b.year}"


def collect(session: Session, company_id: int, start: datetime, end: datetime) -> dict:
    ids = list(
        session.scalars(
            select(QrCode.id).where(
                QrCode.company_id == company_id,
                QrCode.kind == "dynamic",
                QrCode.deleted_at.is_(None),
            )
        )
    )
    length = end - start

    def scans(a: datetime, b: datetime) -> int:
        return (
            session.scalar(
                select(func.count()).where(
                    ScanEvent.qr_code_id.in_(ids),
                    ScanEvent.scanned_at >= a,
                    ScanEvent.scanned_at < b,
                    ScanEvent.is_bot.is_(False),
                    ScanEvent.outcome == "ok",
                )  # fmt: skip
            )
            if ids
            else 0
        )

    def clicks(a: datetime, b: datetime) -> int:
        return (
            session.scalar(
                select(func.count()).where(
                    PageEvent.qr_code_id.in_(ids),
                    PageEvent.created_at >= a,
                    PageEvent.created_at < b,
                )
            )
            if ids
            else 0
        )

    def grouped(column, limit=5):
        if not ids:
            return []
        rows = session.execute(
            select(column, func.count().label("n"))
            .where(ScanEvent.qr_code_id.in_(ids), ScanEvent.scanned_at >= start,
                   ScanEvent.scanned_at < end, ScanEvent.is_bot.is_(False),
                   ScanEvent.outcome == "ok", column.is_not(None))
            .group_by(column).order_by(func.count().desc()).limit(limit)
        ).all()  # fmt: skip
        return [(str(k), n) for k, n in rows]

    top = []
    if ids:
        top = session.execute(
            select(QrCode.name, func.count().label("n"))
            .join(ScanEvent, ScanEvent.qr_code_id == QrCode.id)
            .where(QrCode.id.in_(ids), ScanEvent.scanned_at >= start, ScanEvent.scanned_at < end,
                   ScanEvent.is_bot.is_(False), ScanEvent.outcome == "ok")
            .group_by(QrCode.id, QrCode.name).order_by(func.count().desc()).limit(5)
        ).all()  # fmt: skip
    silent = []
    if ids:
        scanned = set(
            session.scalars(
                select(ScanEvent.qr_code_id)
                .where(
                    ScanEvent.qr_code_id.in_(ids),
                    ScanEvent.scanned_at >= start,
                    ScanEvent.scanned_at < end,
                    ScanEvent.is_bot.is_(False),
                )
                .distinct()
            )  # fmt: skip
        )
        silent = [
            name
            for qid, name in session.execute(
                select(QrCode.id, QrCode.name)
                .where(QrCode.id.in_(ids), QrCode.created_at < start)
                .order_by(QrCode.name)
                .limit(200)
            )
            if qid not in scanned  # fmt: skip
        ][:10]
    return {
        "scans": scans(start, end), "scans_prev": scans(start - length, start),
        "clicks": clicks(start, end), "clicks_prev": clicks(start - length, start),
        "top": [(n, c) for n, c in top], "countries": grouped(ScanEvent.country_code),
        "devices": grouped(ScanEvent.device_type), "silent": silent,
    }  # fmt: skip


def delta(now_value: int, before: int) -> str:
    if before == 0:
        return "nuovo" if now_value else "—"
    change = round((now_value - before) / before * 100)
    return f"{'+' if change > 0 else ''}{change}%"


def render(company: Company, data: dict, kind: str, period: str, unsub_url: str) -> tuple[str, str]:
    """(plain text, HTML) of a report, with the company's colors and logo."""
    e = html.escape
    color = company.primary_color if company.primary_color.startswith("#") else "#087f5b"
    base = get_settings().public_base_url
    logo = (
        f'<img src="{e(base)}/f/{e(company.logo_file_id)}/logo" alt="" height="40" '
        'style="display:block;margin-bottom:8px">' if company.logo_file_id else ""
    )  # fmt: skip

    def block(title: str, rows: list[tuple[str, int]]) -> str:
        if not rows:
            return ""
        lines = "".join(
            f"<tr><td style='padding:2px 12px 2px 0'>{e(k)}</td><td><b>{v}</b></td></tr>"
            for k, v in rows
        )
        return f"<h3 style='margin:20px 0 6px'>{e(title)}</h3><table>{lines}</table>"

    title = "Report settimanale" if kind == "weekly" else "Report mensile"
    silent = (
        "<h3 style='margin:20px 0 6px'>Senza scansioni nel periodo</h3><p style='margin:0'>"
        + e(", ".join(data["silent"])) + "</p>" if data["silent"] else ""
    )  # fmt: skip
    body = (
        f"<div style='font-family:Arial,sans-serif;color:#091411;max-width:560px'>"
        f"<div style='background:{e(color)};color:#fff;padding:20px 24px;border-radius:12px 12px 0 0'>"
        f"{logo}<div style='font-size:20px;font-weight:bold'>{e(company.name)}</div>"
        f"<div>{title} · {e(period)}</div></div>"
        "<div style='padding:20px 24px;border:1px solid #d3e7dc;border-top:0;border-radius:0 0 12px 12px'>"
        f"<p style='font-size:15px'><b style='font-size:28px'>{data['scans']}</b> scansioni "
        f"<span style='color:#567067'>({delta(data['scans'], data['scans_prev'])} sul periodo precedente)</span></p>"
        f"<p style='font-size:15px'><b style='font-size:28px'>{data['clicks']}</b> clic sui link "
        f"<span style='color:#567067'>({delta(data['clicks'], data['clicks_prev'])})</span></p>"
        f"{block('I 5 più scansionati', data['top'])}{block('Paesi', data['countries'])}"
        f"{block('Dispositivi', data['devices'])}{silent}</div>"
        "<p style='font-size:12px;color:#567067;margin-top:16px'>Report generato con Vorya QR · "
        f"<a href='{e(unsub_url)}'>Non voglio più ricevere questi report</a></p></div>"
    )
    lines = [f"{company.name} · {title} · {period}", "",
             f"Scansioni: {data['scans']} ({delta(data['scans'], data['scans_prev'])})",
             f"Clic: {data['clicks']} ({delta(data['clicks'], data['clicks_prev'])})"]  # fmt: skip
    lines += [f"  {n}: {c}" for n, c in data["top"]]
    if data["silent"]:
        lines += ["", "Senza scansioni: " + ", ".join(data["silent"])]
    lines += ["", f"Report generato con Vorya QR. Per non riceverli più: {unsub_url}"]
    return "\n".join(lines), body


def unsubscribe_url(token: str) -> str:
    return f"{get_settings().public_base_url}/report/disiscrizione#{token}"


def schedule(session: Session, at: datetime | None = None) -> int:
    """Queues the reports of the last completed period (idempotent: one row per recipient+period)."""
    at = at or now()
    queued = 0
    for kind in ("weekly", "monthly"):
        start, end = period_for(kind, at)
        rows = session.execute(
            select(ReportSettings, Company, Workspace)
            .join(Company, Company.id == ReportSettings.company_id)
            .join(Workspace, Workspace.id == Company.workspace_id)
            .where(getattr(ReportSettings, kind).is_(True), Company.deleted_at.is_(None),
                   Workspace.status == "active")
        ).all()  # fmt: skip
        for _settings, company, workspace in rows:
            if kind not in features_of(plan_of(session, workspace)).report_frequencies:
                continue
            recipients = session.scalars(
                select(ReportRecipient).where(
                    ReportRecipient.company_id == company.id,
                    ReportRecipient.confirmed_at.is_not(None),
                    ReportRecipient.unsubscribed_at.is_(None),
                )
            )
            for r in recipients:
                exists = session.scalar(
                    select(ReportLog.id).where(
                        ReportLog.recipient_id == r.id, ReportLog.kind == kind,
                        ReportLog.period_end == end,
                    )
                )  # fmt: skip
                if exists:
                    continue
                due = at + timedelta(minutes=(r.id * 37) % SPREAD_MINUTES)
                session.add(ReportLog(company_id=company.id, recipient_id=r.id, kind=kind,
                                      period_start=start, period_end=end, due_at=due))  # fmt: skip
                queued += 1
    session.flush()
    return queued


def send_due(session: Session, limit: int = 20) -> int:
    rows = list(
        session.scalars(
            select(ReportLog)
            .where(ReportLog.state == "pending", ReportLog.due_at <= now())
            .order_by(ReportLog.due_at)
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
    )
    sent = 0
    for row in rows:
        recipient = session.get(ReportRecipient, row.recipient_id)
        company = session.get(Company, row.company_id)
        if (not recipient or recipient.unsubscribed_at or not recipient.confirmed_at
                or company is None or company.deleted_at):  # fmt: skip
            row.state = "skipped"
            continue
        data = collect(session, company.id, row.period_start, row.period_end)
        period = label(row.kind, row.period_start, row.period_end)
        text, body = render(company, data, row.kind, period, unsubscribe_url(recipient.unsub_token))
        try:
            send_email(
                recipient.email,
                f"{'Report settimanale' if row.kind == 'weekly' else 'Report mensile'} · "
                f"{company.name} · {period}",
                text, body, kind="report",
            )  # fmt: skip
            row.state, row.sent_at = "sent", now()
            sent += 1
        except Exception as exc:  # noqa: BLE001
            row.state, row.error = "failed", type(exc).__name__[:80]
    return sent
