"""Admin metrics: computed by the worker into `metrics_snapshots` (never live on heavy queries).

Definitions are deliberately simple and written down in docs/V05.md:
- activation: share of workspaces (signed up 7-37 days ago) with a dynamic QR created within 7
  days of signing up;
- trial -> paying: share of workspaces whose trial ended in the last 90 days that are on a paid plan;
- MRR: active subscriptions at their monthly price (yearly / 12); ARR = MRR x 12; ARPA = MRR / payers;
- churn: subscriptions cancelled in the last 30 days / (active now + cancelled in the last 30 days).
Discounts and coupons are not considered.
"""

import csv
import io
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .core.csvsafe import safe_row
from .core.security import now
from .models import (
    AuditLog,
    BillingAccount,
    BillingPrice,
    Company,
    GeneratorCounter,
    MetricsSnapshot,
    Plan,
    QrCode,
    ScanEvent,
    Workspace,
)
from .plans import FREE_PLAN, effective_plan_id


def _pct(part: int, whole: int) -> float | None:
    return round(part / whole * 100, 1) if whole else None


def source_of(attribution: dict | None) -> str:
    a = attribution or {}
    if a.get("generator"):
        return "generatore gratuito"
    return a.get("utm_source") or (a.get("referrer") or "").split("/")[0] or "diretto"


def compute(session: Session, at: datetime | None = None) -> dict:
    at = at or now()
    workspaces = list(session.scalars(select(Workspace)))
    plans = {p.id: p for p in session.scalars(select(Plan))}
    first_dynamic = {
        w_id: first
        for w_id, first in session.execute(
            select(QrCode.workspace_id, func.min(QrCode.created_at))
            .where(QrCode.kind == "dynamic")
            .group_by(QrCode.workspace_id)
        )
    }

    def signups(days: int) -> int:
        return sum(1 for w in workspaces if w.created_at >= at - timedelta(days=days))

    series = {}
    for i in range(29, -1, -1):
        d = (at - timedelta(days=i)).date()
        series[d.isoformat()] = sum(1 for w in workspaces if w.created_at.date() == d)

    cohort = [
        w for w in workspaces if at - timedelta(days=37) <= w.created_at <= at - timedelta(days=7)
    ]
    activated = [
        w for w in cohort
        if (f := first_dynamic.get(w.id)) and f <= w.created_at + timedelta(days=7)
    ]  # fmt: skip
    ended = [
        w
        for w in workspaces
        if w.trial_ends_at and at - timedelta(days=90) <= w.trial_ends_at <= at
    ]
    paying_ended = [w for w in ended if w.billing_state in ("active", "past_due")]

    prices = {p.stripe_price_id: p for p in session.scalars(select(BillingPrice))}
    accounts = {a.workspace_id: a for a in session.scalars(select(BillingAccount))}
    mrr_cents, payers = 0, 0
    for w in workspaces:
        account = accounts.get(w.id)
        if w.billing_state not in ("active", "past_due") or account is None:
            continue
        price = prices.get(account.price_id or "")
        if price is None:
            continue
        payers += 1
        mrr_cents += price.amount_cents // 12 if price.cycle == "yearly" else price.amount_cents
    cancelled = sum(
        1 for a in accounts.values()
        if workspaces_by_id(workspaces, a.workspace_id, "canceled") and a.updated_at >= at - timedelta(days=30)
    )  # fmt: skip

    distribution: dict[str, int] = {}
    for w in workspaces:
        plan_id = effective_plan_id(w, at)
        distribution[plan_id] = distribution.get(plan_id, 0) + 1

    changes = {"upgrades": 0, "downgrades": 0}
    for row in session.scalars(
        select(AuditLog).where(
            AuditLog.action == "billing.plan_changed",
            AuditLog.created_at >= at - timedelta(days=30),
        )
    ):
        old, new = (
            plans.get((row.details or {}).get("old")),
            plans.get((row.details or {}).get("new")),
        )
        if old and new:
            changes["upgrades" if new.position > old.position else "downgrades"] += 1

    funnel_sources: dict[str, dict[str, int]] = {}
    for w in workspaces:
        s = funnel_sources.setdefault(
            source_of(w.attribution), {"signups": 0, "activated": 0, "paying": 0}
        )
        s["signups"] += 1
        s["activated"] += 1 if w.id in first_dynamic else 0
        s["paying"] += 1 if w.billing_state in ("active", "past_due") else 0
    generator = {"view": 0, "preview": 0, "download": 0}
    landings: dict[str, dict[str, int]] = {}
    for event, landing, total in session.execute(
        select(GeneratorCounter.event, GeneratorCounter.landing, func.sum(GeneratorCounter.count))
        .where(GeneratorCounter.day >= (at - timedelta(days=30)).date())
        .group_by(GeneratorCounter.event, GeneratorCounter.landing)
    ):
        generator[event] = generator.get(event, 0) + int(total)
        landings.setdefault(landing, {"view": 0, "download": 0, "signups": 0})
        if event in ("view", "download"):
            landings[landing][event] = int(total)
    for w in workspaces:
        landing = (w.attribution or {}).get("landing")
        if landing:
            landings.setdefault(landing, {"view": 0, "download": 0, "signups": 0})["signups"] += 1

    types = dict(
        session.execute(
            select(QrCode.qr_type, func.count())
            .where(QrCode.deleted_at.is_(None))
            .group_by(QrCode.qr_type)
        ).all()
    )
    scans_30d = session.scalar(
        select(func.count()).where(
            ScanEvent.scanned_at >= at - timedelta(days=30), ScanEvent.is_bot.is_(False),
            ScanEvent.outcome == "ok",
        )
    )  # fmt: skip
    companies = session.scalar(
        select(func.count()).select_from(Company).where(Company.deleted_at.is_(None))
    )
    trials = sum(
        1 for w in workspaces
        if w.trial_ends_at and w.trial_ends_at > at and w.billing_state is None and w.grant_until is None
    )  # fmt: skip
    return {
        "computed_at": at.isoformat(),
        "signups": {"day": signups(1), "week": signups(7), "month": signups(30), "total": len(workspaces), "series": series},
        "activation": {"cohort": len(cohort), "activated": len(activated), "percent": _pct(len(activated), len(cohort))},
        "trials_active": trials,
        "conversion": {"ended": len(ended), "paying": len(paying_ended), "percent": _pct(len(paying_ended), len(ended))},
        "revenue": {
            "mrr_cents": mrr_cents, "arr_cents": mrr_cents * 12, "payers": payers,
            "arpa_cents": mrr_cents // payers if payers else None,
        },
        "churn": {"cancelled_30d": cancelled, "percent": _pct(cancelled, payers + cancelled)},
        "plans": distribution,
        "plan_changes_30d": changes,
        "funnel": {"generator": generator, "sources": funnel_sources, "landings": landings},
        "usage": {"scans_30d": scans_30d, "types": types, "companies": companies,
                  "companies_per_account": round(companies / len(workspaces), 2) if workspaces else None},
        "free_accounts": distribution.get(FREE_PLAN, 0),
    }  # fmt: skip


def workspaces_by_id(workspaces: list[Workspace], workspace_id: int, state: str) -> bool:
    return any(w.id == workspace_id and w.billing_state == state for w in workspaces)


def snapshot(session: Session, at: datetime | None = None) -> MetricsSnapshot:
    data = compute(session, at)
    day = (at or now()).astimezone(UTC).date()
    row = session.get(MetricsSnapshot, day)
    if row is None:
        row = MetricsSnapshot(day=day, data=data)
        session.add(row)
    else:
        row.data = data
    session.flush()
    return row


def latest(session: Session) -> MetricsSnapshot | None:
    return session.scalar(select(MetricsSnapshot).order_by(MetricsSnapshot.day.desc()).limit(1))


def as_csv(data: dict) -> str:
    out = io.StringIO()
    writer = csv.writer(out, delimiter=";")
    writer.writerow(["Metrica", "Valore"])

    def row(label, value):
        writer.writerow(safe_row([label, "" if value is None else value]))

    row("Calcolato il", data["computed_at"])
    for key, label in (
        ("day", "Iscritti oggi"),
        ("week", "Iscritti 7 giorni"),
        ("month", "Iscritti 30 giorni"),
        ("total", "Iscritti totali"),
    ):
        row(label, data["signups"][key])
    row("Attivazione % (primo QR dinamico entro 7 giorni)", data["activation"]["percent"])
    row("Trial attivi", data["trials_active"])
    row("Conversione trial → pagante %", data["conversion"]["percent"])
    for key, label in (("mrr_cents", "MRR €"), ("arr_cents", "ARR €"), ("arpa_cents", "ARPA €")):
        v = data["revenue"][key]
        row(label, None if v is None else f"{v / 100:.2f}".replace(".", ","))
    row("Churn mensile %", data["churn"]["percent"])
    row("Upgrade 30 giorni", data["plan_changes_30d"]["upgrades"])
    row("Downgrade 30 giorni", data["plan_changes_30d"]["downgrades"])
    for plan, count in data["plans"].items():
        row(f"Account sul piano {plan}", count)
    for source, s in data["funnel"]["sources"].items():
        row(
            f"Fonte {source}: iscritti/attivati/paganti",
            f"{s['signups']}/{s['activated']}/{s['paying']}",
        )
    for event, count in data["funnel"]["generator"].items():
        row(f"Generatore {event} (30 giorni)", count)
    row("Scansioni 30 giorni", data["usage"]["scans_30d"])
    for qr_type, count in data["usage"]["types"].items():
        row(f"Codici di tipo {qr_type}", count)
    row("Aziende per account", data["usage"]["companies_per_account"])
    return "﻿" + out.getvalue()


__all__ = ["as_csv", "compute", "date", "latest", "snapshot"]
