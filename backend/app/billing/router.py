"""Customer billing API, public plan list and the Stripe webhook."""

import hashlib
import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..access import workspace_access
from ..auth.deps import Auth, owned_workspace, require_roles
from ..core.config import get_settings
from ..core.database import get_session
from ..core.errors import CodedError
from ..core.security import now
from ..models import (
    BillingAccount,
    BillingEvent,
    BillingPayment,
    BillingPrice,
    BillingProfile,
    Plan,
    Workspace,
)
from ..plans import TYPE_LABELS, effective_types, features_of, plan_of
from ..quotas import usage
from . import gateway, service
from .settings import billing_settings
from .validation import BillingProfileIn

log = logging.getLogger("vorya_qr.billing")
router = APIRouter(tags=["billing"])
Cycle = Literal["monthly", "yearly"]
PROFILE_FIELDS = (
    "legal_name", "vat", "tax_code", "address", "zip", "city",
    "province", "country", "sdi_code", "pec",
)  # fmt: skip


def billing_ctx(
    auth: Auth = Depends(require_roles("company_admin")),
    session: Session = Depends(get_session),
) -> tuple[Auth, Workspace]:
    """Like client_context but WITHOUT the access check: blocked accounts must reach /plans."""
    workspace = owned_workspace(session, auth.user, lock=False)
    if workspace is None:
        raise HTTPException(403, "Nessuno spazio di lavoro associato all'account.")
    return auth, workspace


class Selection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: str
    cycle: Cycle


class Cancel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cancel: bool = True


def price_of(session: Session, plan_id: str, cycle: str) -> BillingPrice:
    price = session.scalar(
        select(BillingPrice).where(
            BillingPrice.plan_id == plan_id,
            BillingPrice.cycle == cycle,
            BillingPrice.active.is_(True),
        )
    )
    if price is None:
        raise HTTPException(409, "Questo piano non è acquistabile online al momento.")
    return price


def profile_out(row: BillingProfile | None) -> dict | None:
    return {f: getattr(row, f) for f in PROFILE_FIELDS} if row else None


def state_of(workspace: Workspace) -> str:
    """The five customer-facing states."""
    access = workspace_access(workspace)
    if workspace.grant_until and workspace.grant_until > now():
        return "gift"
    if workspace.billing_state == "active":
        return "active"
    if workspace.billing_state == "past_due":
        return "past_due"
    if workspace.billing_state in ("canceled", "unpaid"):
        return workspace.billing_state
    return {"trial": "trialing", "free": "free"}.get(access, "active")


def plan_card(plan: Plan, prices: dict) -> dict:
    features = features_of(plan)
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "limits": {
            "static_qr": plan.max_qr_static,
            "dynamic_qr": plan.max_dynamic_qr,
            "companies": plan.max_companies,
        },
        "features": {**features.model_dump(), "allowed_types": effective_types(features)},
        "prices": prices.get(plan.id, {}),
    }


def price_map(session: Session) -> dict:
    out: dict[str, dict] = {}
    for p in session.scalars(select(BillingPrice).where(BillingPrice.active.is_(True))):
        out.setdefault(p.plan_id, {})[p.cycle] = {"amount_cents": p.amount_cents, "currency": p.currency}  # fmt: skip
    return out


@router.get("/api/public/plans")
def public_plans(session: Session = Depends(get_session)):
    prices = price_map(session)
    plans = session.scalars(
        select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.position, Plan.id)
    )
    return {
        "plans": [plan_card(p, prices) for p in plans],
        "type_labels": TYPE_LABELS,
        "online_payments": gateway.configured(),
    }


@router.get("/api/account/billing")
def read_billing(
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx), session: Session = Depends(get_session)
):
    _, workspace = ctx
    account = session.get(BillingAccount, workspace.id)
    plan = plan_of(session, workspace)
    prices = price_map(session)
    payments = session.scalars(
        select(BillingPayment)
        .where(BillingPayment.workspace_id == workspace.id)
        .order_by(BillingPayment.created_at.desc())
        .limit(24)
    )
    cfg = billing_settings(session)
    return {
        "state": state_of(workspace),
        "access": workspace_access(workspace),
        "plan": plan_card(plan, prices),
        "plans": [
            plan_card(p, prices)
            for p in session.scalars(
                select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.position, Plan.id)
            )
        ],
        "type_labels": TYPE_LABELS,
        "cycle": account.cycle if account else None,
        "period_end": account.period_end if account else None,
        "cancel_at_period_end": bool(account and account.cancel_at_period_end),
        "has_subscription": bool(
            account
            and account.subscription_id
            and workspace.billing_state in ("active", "past_due")
        ),
        "trial_ends_at": workspace.trial_ends_at,
        "grace_until": workspace.grace_until,
        "grant_until": workspace.grant_until,
        "grace_days": cfg["grace_days"],
        "usage": usage(session, workspace),
        "profile": profile_out(session.get(BillingProfile, workspace.id)),
        "online_payments": gateway.configured(),
        "payments": [
            {
                "id": p.invoice_id,
                "amount_cents": p.amount_cents,
                "currency": p.currency,
                "status": p.status,
                "paid_at": p.paid_at,
                "document_url": p.document_url,
            }
            for p in payments
        ],
    }


@router.put("/api/account/billing/profile")
def save_profile(
    payload: BillingProfileIn,
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx),
    session: Session = Depends(get_session),
):
    _, workspace = ctx
    row = session.get(BillingProfile, workspace.id)
    if row is None:
        row = BillingProfile(workspace_id=workspace.id)
        session.add(row)
    for field in PROFILE_FIELDS:
        setattr(row, field, getattr(payload, field))
    session.commit()
    return profile_out(row)


def _customer(session: Session, workspace: Workspace, auth: Auth, profile: BillingProfile) -> str:
    account = service.account_of(session, workspace.id)
    params = {"name": profile.legal_name, "email": auth.user.email,
              "address": {"line1": profile.address, "postal_code": profile.zip,
                          "city": profile.city, "country": profile.country}}  # fmt: skip
    if account.customer_id:
        gateway.update_customer(account.customer_id, **params)
        return account.customer_id
    customer = gateway.create_customer(**params, metadata={"workspace_id": str(workspace.id)})
    account.customer_id = customer["id"]
    session.commit()  # keep the link even if the checkout creation fails afterwards
    return account.customer_id


@router.post("/api/account/billing/checkout")
def checkout(
    payload: Selection,
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx),
    session: Session = Depends(get_session),
):
    auth, workspace = ctx
    if workspace.status == "suspended":
        raise HTTPException(423, "Account sospeso. Contattaci per maggiori informazioni.")
    if workspace.billing_state in ("active", "past_due"):
        raise HTTPException(409, "Hai già un abbonamento: usa «Cambia piano».")
    profile = session.get(BillingProfile, workspace.id)
    if profile is None:
        raise CodedError(
            422, "Prima di pagare servono i dati di fatturazione.", "billing_profile_required"
        )
    price = price_of(session, payload.plan_id, payload.cycle)
    customer = _customer(session, workspace, auth, profile)
    base = get_settings().public_base_url
    meta = {"workspace_id": str(workspace.id), "plan_id": price.plan_id}
    created = gateway.create_checkout(
        mode="subscription",
        customer=customer,
        client_reference_id=str(workspace.id),
        line_items=[{"price": price.stripe_price_id, "quantity": 1}],
        metadata=meta,
        subscription_data={"metadata": meta},
        success_url=f"{base}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base}/billing/cancelled",
        locale="it",
    )
    service.account_of(session, workspace.id).checkout_id = created["id"]
    session.commit()
    return {"url": created["url"]}


@router.post("/api/account/billing/portal")
def portal(
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx), session: Session = Depends(get_session)
):
    _, workspace = ctx
    account = session.get(BillingAccount, workspace.id)
    if account is None or not account.customer_id:
        raise HTTPException(409, "Nessun metodo di pagamento da gestire.")
    created = gateway.create_portal(
        customer=account.customer_id, return_url=f"{get_settings().public_base_url}/app/account/plan"
    )  # fmt: skip
    return {"url": created["url"]}


def _live_subscription(session: Session, workspace: Workspace) -> tuple[BillingAccount, dict]:
    account = session.get(BillingAccount, workspace.id)
    if account is None or not account.subscription_id or workspace.billing_state not in (
        "active", "past_due",
    ):  # fmt: skip
        raise HTTPException(409, "Non hai un abbonamento attivo da modificare.")
    return account, gateway.retrieve_subscription(account.subscription_id)


@router.post("/api/account/billing/change-preview")
def change_preview(
    payload: Selection,
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx),
    session: Session = Depends(get_session),
):
    _, workspace = ctx
    account, sub = _live_subscription(session, workspace)
    price = price_of(session, payload.plan_id, payload.cycle)
    if price.stripe_price_id == account.price_id:
        raise HTTPException(409, "È già il tuo piano attuale.")
    item = sub["items"]["data"][0]["id"]
    preview = gateway.preview_invoice(
        customer=account.customer_id,
        subscription=account.subscription_id,
        subscription_details={
            "items": [{"id": item, "price": price.stripe_price_id}],
            "proration_behavior": "create_prorations",
        },
    )
    return {
        "amount_due_cents": preview.get("amount_due", 0),
        "currency": preview.get("currency", "eur"),
        "plan_id": price.plan_id,
        "cycle": price.cycle,
        "new_amount_cents": price.amount_cents,
    }


@router.post("/api/account/billing/change")
def change_plan(
    payload: Selection,
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx),
    session: Session = Depends(get_session),
):
    _, workspace = ctx
    account, sub = _live_subscription(session, workspace)
    price = price_of(session, payload.plan_id, payload.cycle)
    if price.stripe_price_id == account.price_id:
        raise HTTPException(409, "È già il tuo piano attuale.")
    updated = gateway.update_subscription(
        account.subscription_id,
        items=[{"id": sub["items"]["data"][0]["id"], "price": price.stripe_price_id}],
        proration_behavior="create_prorations",
        cancel_at_period_end=False,
    )
    updated.setdefault("metadata", {}).setdefault("workspace_id", str(workspace.id))
    service.apply_subscription(session, updated)
    session.commit()
    return {"ok": True, "plan_id": price.plan_id}


@router.post("/api/account/billing/cancel")
def cancel(
    payload: Cancel,
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx),
    session: Session = Depends(get_session),
):
    """Cancel at period end (or take it back). The plan stays until the paid period ends."""
    _, workspace = ctx
    account, _ = _live_subscription(session, workspace)
    updated = gateway.update_subscription(
        account.subscription_id, cancel_at_period_end=payload.cancel
    )
    updated.setdefault("metadata", {}).setdefault("workspace_id", str(workspace.id))
    service.apply_subscription(session, updated)
    session.commit()
    return {"cancel_at_period_end": payload.cancel}


@router.post("/api/account/billing/refresh")
def refresh(
    ctx: tuple[Auth, Workspace] = Depends(billing_ctx), session: Session = Depends(get_session)
):
    """Called by the success page: pulls the subscription in case the webhook is late."""
    _, workspace = ctx
    account = session.get(BillingAccount, workspace.id)
    if account is None or not account.subscription_id:
        return {"state": state_of(workspace)}
    service.apply_subscription(session, gateway.retrieve_subscription(account.subscription_id))
    session.commit()
    session.refresh(workspace)
    return {"state": state_of(workspace)}


@router.post("/api/public/stripe-webhook", include_in_schema=False)
async def webhook(request: Request, session: Session = Depends(get_session)):
    body = b""
    async for chunk in request.stream():
        body += chunk
        if len(body) > 1024 * 1024:
            raise HTTPException(413, "Evento troppo grande.")
    event = gateway.verify_webhook(body, request.headers.get("stripe-signature", ""))
    if bool(event.get("livemode")) != (gateway.mode() == "live"):
        raise HTTPException(400, "Modalità webhook non coerente.")
    if gateway.mode() == "live" and not get_settings().stripe_live_allowed:
        raise HTTPException(409, "Live non abilitato.")
    key = int.from_bytes(hashlib.sha256(event["id"].encode()).digest()[:8], "big", signed=True)
    session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": key})
    if session.get(BillingEvent, event["id"]) is None:
        try:
            state = service.handle_event(session, event)
        except HTTPException:
            session.rollback()
            raise
        except Exception:
            session.rollback()
            log.exception("Stripe event %s failed", event["id"])
            raise HTTPException(500, "Evento non elaborato.") from None  # Stripe will retry
        session.add(BillingEvent(id=event["id"], event_type=event["type"][:100], state=state))
        session.commit()
    return {"received": True}
