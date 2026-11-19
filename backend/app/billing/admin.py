"""Admin billing: price links (no amounts in code), grace settings, payments + CSV export."""

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth.deps import Auth, admin_reader, admin_writer
from ..auth.service import audit
from ..core.config import get_settings
from ..core.csvsafe import safe_row
from ..core.database import get_session
from ..models import (
    BillingEvent,
    BillingPayment,
    BillingPrice,
    Plan,
    PlatformSetting,
    User,
    Workspace,
)
from . import gateway
from .settings import billing_settings

router = APIRouter(prefix="/api/admin/billing", tags=["admin-billing"])


class PriceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: str
    cycle: str = Field(pattern="^(monthly|yearly)$")
    stripe_price_id: str = Field(pattern=r"^price_[A-Za-z0-9]{6,90}$")


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    grace_days: int = Field(ge=0, le=60)
    redirect_days: int = Field(ge=0, le=365)


def price_out(p: BillingPrice) -> dict:
    return {
        "id": p.id,
        "plan_id": p.plan_id,
        "cycle": p.cycle,
        "stripe_price_id": p.stripe_price_id,
        "amount_cents": p.amount_cents,
        "currency": p.currency,
        "active": p.active,
    }


@router.get("/status")
def status(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    s = get_settings()
    return {
        "key_configured": gateway.configured(),
        "mode": gateway.mode(),
        "live_allowed": s.stripe_live_allowed,
        "webhook_configured": bool(s.stripe_webhook_secret.get_secret_value()),
        "settings": billing_settings(session),
    }


@router.put("/settings")
def save_settings(
    payload: SettingsIn,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    row = session.get(PlatformSetting, "billing")
    if row is None:
        row = PlatformSetting(key="billing", data={})
        session.add(row)
    row.data = {**payload.model_dump()}
    audit(session, auth.user, "admin.billing_settings", None)
    session.commit()
    return billing_settings(session)


@router.get("/prices")
def list_prices(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    rows = session.scalars(select(BillingPrice).order_by(BillingPrice.plan_id, BillingPrice.cycle, BillingPrice.id.desc()))  # fmt: skip
    return [price_out(p) for p in rows]


@router.post("/prices", status_code=201)
def link_price(
    payload: PriceIn,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    """Links a Stripe price to a plan. Amount/interval are read from Stripe, never typed."""
    if session.get(Plan, payload.plan_id) is None:
        raise HTTPException(404, "Piano non trovato.")
    if session.scalar(select(BillingPrice.id).where(BillingPrice.stripe_price_id == payload.stripe_price_id)):  # fmt: skip
        raise HTTPException(409, "Questo prezzo Stripe è già collegato.")
    remote = gateway.retrieve_price(payload.stripe_price_id)
    interval = (remote.get("recurring") or {}).get("interval")
    expected = {"monthly": "month", "yearly": "year"}[payload.cycle]
    if not remote.get("active") or interval != expected or remote.get("unit_amount") is None:
        raise HTTPException(422, "Il prezzo Stripe deve essere attivo, ricorrente e coerente col ciclo.")  # fmt: skip
    for old in session.scalars(
        select(BillingPrice).where(
            BillingPrice.plan_id == payload.plan_id,
            BillingPrice.cycle == payload.cycle,
            BillingPrice.active.is_(True),
        )
    ):
        old.active = False  # old subscribers keep it: apply_subscription finds it by Stripe id
    session.flush()
    row = BillingPrice(
        plan_id=payload.plan_id,
        cycle=payload.cycle,
        stripe_price_id=payload.stripe_price_id,
        amount_cents=int(remote["unit_amount"]),
        currency=(remote.get("currency") or "eur")[:3],
    )
    session.add(row)
    audit(
        session, auth.user, "admin.billing_price", None, plan=payload.plan_id, cycle=payload.cycle
    )
    session.commit()
    return price_out(row)


@router.delete("/prices/{price_id}", status_code=204)
def deactivate_price(
    price_id: int, auth: Auth = Depends(admin_writer), session: Session = Depends(get_session)
):
    row = session.get(BillingPrice, price_id)
    if row is None:
        raise HTTPException(404, "Prezzo non trovato.")
    row.active = False
    audit(session, auth.user, "admin.billing_price_off", None, plan=row.plan_id)
    session.commit()


def payment_rows(session: Session, start: datetime | None, end: datetime | None):
    query = (
        select(BillingPayment, Workspace, User)
        .join(Workspace, Workspace.id == BillingPayment.workspace_id)
        .join(User, User.id == Workspace.owner_user_id)
        .order_by(BillingPayment.paid_at.desc().nulls_last(), BillingPayment.created_at.desc())
    )
    if start:
        query = query.where(BillingPayment.paid_at >= start)
    if end:
        query = query.where(BillingPayment.paid_at < end)
    return session.execute(query.limit(5000)).all()


@router.get("/payments")
def payments(
    start: datetime | None = None,
    end: datetime | None = None,
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    return [
        {
            "invoice_id": p.invoice_id,
            "workspace": w.name,
            "email": u.email,
            "plan_id": p.plan_id,
            "amount_cents": p.amount_cents,
            "currency": p.currency,
            "status": p.status,
            "paid_at": p.paid_at,
            "profile": p.profile,
            "document_url": p.document_url,
        }
        for p, w, u in payment_rows(session, start, end)
    ]


@router.get("/payments.csv")
def payments_csv(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    """For external e-invoicing: one row per payment with the billing data of that moment."""
    out = io.StringIO()
    writer = csv.writer(out, delimiter=";")
    writer.writerow(["Data", "Fattura Stripe", "Importo", "Valuta", "Stato", "Piano", "Ragione sociale", "P.IVA", "Codice fiscale", "Indirizzo", "CAP", "Città", "Provincia", "Paese", "SDI", "PEC", "Email"])  # fmt: skip
    for p, _w, user in payment_rows(session, start, end):
        d = p.profile or {}
        writer.writerow(
            safe_row([
                p.paid_at.date().isoformat() if p.paid_at else "", p.invoice_id,
                f"{p.amount_cents / 100:.2f}".replace(".", ","), p.currency.upper(), p.status,
                p.plan_id or "", d.get("legal_name", ""), d.get("vat", ""), d.get("tax_code", ""),
                d.get("address", ""), d.get("zip", ""), d.get("city", ""), d.get("province", ""),
                d.get("country", ""), d.get("sdi_code", ""), d.get("pec", ""), user.email,
            ])
        )  # fmt: skip
    body = "﻿" + out.getvalue()
    return Response(
        body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="pagamenti-vorya-qr.csv"'},
    )


@router.get("/events")
def events(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    rows = session.scalars(select(BillingEvent).order_by(BillingEvent.received_at.desc()).limit(100))  # fmt: skip
    return [
        {"id": e.id, "type": e.event_type, "state": e.state, "received_at": e.received_at}
        for e in rows
    ]
