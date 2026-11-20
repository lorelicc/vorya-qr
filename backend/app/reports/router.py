"""Report settings of a company (app) and the public confirm / unsubscribe links."""

import html
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, client_ip, rate_limit, too_many
from ..core.config import get_settings
from ..core.database import get_session
from ..core.security import digest, now
from ..mail.mailer import send_email
from ..mail.templates import _layout
from ..models import Company, ReportRecipient, ReportSettings
from ..plans import features_of, locked, plan_of

router = APIRouter(prefix="/api/companies/{company_id}/reports", tags=["reports"])
public = APIRouter(prefix="/api/public/report-subscriptions", tags=["reports"])


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weekly: bool = False
    monthly: bool = False


class RecipientIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=254, pattern=r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")


class TokenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


def view(session: Session, ctx: CompanyContext) -> dict:
    features = features_of(plan_of(session, ctx.workspace))
    row = session.get(ReportSettings, ctx.company.id)
    recipients = session.scalars(
        select(ReportRecipient)
        .where(ReportRecipient.company_id == ctx.company.id)
        .order_by(ReportRecipient.id)
    )
    return {
        "frequencies_allowed": features.report_frequencies,
        "max_recipients": features.report_recipients,
        "weekly": bool(row and row.weekly),
        "monthly": bool(row and row.monthly),
        "recipients": [
            {
                "id": r.id,
                "email": r.email,
                "status": "unsubscribed" if r.unsubscribed_at else "active" if r.confirmed_at else "pending",
            }
            for r in recipients
        ],
    }  # fmt: skip


def send_confirmation(email: str, company: str, token: str) -> None:
    url = f"{get_settings().public_base_url}/report/conferma#{token}"
    text = (
        f"Hai ricevuto una richiesta per inviarti i report di «{company}» su Vorya QR.\n"
        f"Per confermare: {url}\nSe non conosci questa richiesta, ignora l'email."
    )
    send_email(
        email,
        f"Conferma i report di {company} · Vorya QR",
        text,
        _layout(
            "Conferma i report",
            f"Ti hanno chiesto di inviarti i report delle scansioni di «{html.escape(company)}». "
            "Se vuoi riceverli, conferma. Altrimenti ignora questa email.",
            url,
            "Conferma",
        ),
        kind="report-confirm",
    )


@router.get("")
def read(ctx: CompanyContext = Depends(owned_company), session: Session = Depends(get_session)):
    return view(session, ctx)


@router.put("")
def save(
    payload: SettingsIn,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    allowed = features_of(plan_of(session, ctx.workspace)).report_frequencies
    if not allowed:
        raise locked("I report via email")
    for kind in ("weekly", "monthly"):
        if getattr(payload, kind) and kind not in allowed:
            raise locked(f"Il report {'settimanale' if kind == 'weekly' else 'mensile'}")
    row = session.get(ReportSettings, ctx.company.id) or ReportSettings(company_id=ctx.company.id)
    row.weekly, row.monthly = payload.weekly, payload.monthly
    session.merge(row)
    session.commit()
    return view(session, ctx)


@router.post("/recipients", status_code=201)
def add_recipient(
    payload: RecipientIn,
    tasks: BackgroundTasks,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    features = features_of(plan_of(session, ctx.workspace))
    if not features.report_recipients:
        raise locked("I report via email")
    email = payload.email.strip().lower()
    used = session.scalar(
        select(func.count()).where(
            ReportRecipient.company_id == ctx.company.id, ReportRecipient.unsubscribed_at.is_(None)
        )
    )
    if used >= features.report_recipients:
        raise HTTPException(
            409, f"Il piano consente {features.report_recipients} destinatari per azienda."
        )
    token = secrets.token_urlsafe(32)
    row = session.scalar(
        select(ReportRecipient).where(
            ReportRecipient.company_id == ctx.company.id, ReportRecipient.email == email
        )
    )
    if row is None:
        row = ReportRecipient(company_id=ctx.company.id, email=email,
                              confirm_hash=digest(token), unsub_token=secrets.token_urlsafe(32))  # fmt: skip
        session.add(row)
    elif row.confirmed_at and not row.unsubscribed_at:
        raise HTTPException(409, "Questo destinatario è già attivo.")
    else:  # asking again after an unsubscribe: a new confirmation is required
        row.confirm_hash, row.confirmed_at, row.unsubscribed_at = digest(token), None, None
    audit(session, ctx.user, "report.recipient_added", ctx.workspace.id, ctx.company.id)
    session.commit()
    tasks.add_task(send_confirmation, email, ctx.company.name, token)
    return view(session, ctx)


@router.delete("/recipients/{recipient_id}")
def remove_recipient(
    recipient_id: int,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    row = session.get(ReportRecipient, recipient_id)
    if row is None or row.company_id != ctx.company.id:
        raise HTTPException(404, "Destinatario non trovato.")
    session.delete(row)
    session.commit()
    return view(session, ctx)


@public.post("/confirm")
def confirm(payload: TokenIn, request: Request, session: Session = Depends(get_session)):
    if not rate_limit(session, "report-confirm", client_ip(request), 30, 600):
        raise too_many(600)
    row = session.scalar(
        select(ReportRecipient).where(ReportRecipient.confirm_hash == digest(payload.token))
    )
    if row is None or row.unsubscribed_at:
        raise HTTPException(400, "Link scaduto o non valido.")
    row.confirmed_at = row.confirmed_at or now()
    company = session.get(Company, row.company_id)
    session.commit()
    return {"company": company.name if company else ""}


@public.post("/unsubscribe")
def unsubscribe(payload: TokenIn, request: Request, session: Session = Depends(get_session)):
    """One click, no login: the token in every email is the proof."""
    if not rate_limit(session, "report-unsub", client_ip(request), 30, 600):
        raise too_many(600)
    row = session.scalar(
        select(ReportRecipient).where(ReportRecipient.unsub_token == payload.token)
    )
    if row is None:
        raise HTTPException(400, "Link non valido.")
    row.unsubscribed_at = row.unsubscribed_at or now()
    session.commit()
    return {"ok": True}
