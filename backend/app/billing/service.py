"""Billing state machine: Stripe subscription -> workspace plan/state, payments, mail outbox.

States (workspaces.billing_state): active | past_due | canceled | unpaid | NULL.
`trialing` is the app trial (workspaces.trial_ends_at) and is derived, not stored.
Everything here is idempotent: a replayed event produces the same rows.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..core.security import now
from ..models import (
    BillingAccount,
    BillingMail,
    BillingPayment,
    BillingPrice,
    BillingProfile,
    Workspace,
)
from .settings import billing_settings

log = logging.getLogger("vorya_qr.billing")
LIVE = {"active", "trialing"}


def ts(value) -> datetime | None:
    return datetime.fromtimestamp(int(value), UTC) if value else None


def ref(value) -> str | None:
    return value.get("id") if isinstance(value, dict) else value


def account_of(session: Session, workspace_id: int) -> BillingAccount:
    row = session.get(BillingAccount, workspace_id)
    if row is None:
        row = BillingAccount(workspace_id=workspace_id)
        session.add(row)
        session.flush()
    return row


def enqueue_mail(session: Session, workspace_id: int, key: str, kind: str) -> None:
    session.execute(
        insert(BillingMail)
        .values(workspace_id=workspace_id, event_key=key, kind=kind)
        .on_conflict_do_nothing(index_elements=["event_key"])
    )


def find_workspace(session: Session, sub: dict) -> Workspace | None:
    customer = ref(sub.get("customer"))
    if customer:
        row = session.scalar(select(BillingAccount).where(BillingAccount.customer_id == customer))
        if row:
            return session.get(Workspace, row.workspace_id, with_for_update=True)
    meta = (sub.get("metadata") or {}).get("workspace_id")
    if meta and str(meta).isdigit():
        return session.get(Workspace, int(meta), with_for_update=True)
    return None


def subscription_price(sub: dict) -> str | None:
    items = (sub.get("items") or {}).get("data") or []
    price = items[0].get("price") if items else None
    return ref(price)


def period_end(sub: dict) -> datetime | None:
    items = (sub.get("items") or {}).get("data") or []
    raw = sub.get("current_period_end") or (items[0].get("current_period_end") if items else None)
    return ts(raw)


def apply_subscription(session: Session, sub: dict) -> str | None:
    """Mirror a Stripe subscription onto the workspace. Returns the new billing_state."""
    workspace = find_workspace(session, sub)
    if workspace is None:
        log.warning("Stripe subscription without a known workspace")
        return None
    account = account_of(session, workspace.id)
    sub_id, status = sub["id"], sub.get("status")
    if account.subscription_id and account.subscription_id != sub_id and status == "canceled":
        return workspace.billing_state  # an old subscription ending: the current one rules
    if status in {"incomplete", "incomplete_expired"}:
        return workspace.billing_state
    settings = billing_settings(session)
    account.customer_id = ref(sub.get("customer")) or account.customer_id
    account.subscription_id = sub_id
    account.stripe_status = status
    account.cancel_at_period_end = bool(sub.get("cancel_at_period_end"))
    account.period_end = period_end(sub)
    price_id = subscription_price(sub)
    price = (
        session.scalar(select(BillingPrice).where(BillingPrice.stripe_price_id == price_id))
        if price_id
        else None
    )
    if price:
        account.price_id, account.plan_id, account.cycle = price_id, price.plan_id, price.cycle
    at = now()
    redirect_days = timedelta(days=int(settings["redirect_days"]))
    if status in LIVE:
        if price is None:
            log.error("Stripe price %s is not linked to a plan", price_id)
            return workspace.billing_state
        workspace.plan_id, workspace.trial_ends_at = price.plan_id, None
        workspace.billing_state, workspace.grace_until = "active", None
        workspace.redirects_until, account.past_due_since = None, None
    elif status == "past_due":
        account.past_due_since = account.past_due_since or at
        grace = account.past_due_since + timedelta(days=int(settings["grace_days"]))
        workspace.billing_state, workspace.grace_until = "past_due", grace
        workspace.redirects_until = grace + redirect_days
    else:  # canceled, unpaid, paused
        state = "canceled" if status == "canceled" else "unpaid"
        if workspace.billing_state != state:
            workspace.redirects_until = at + redirect_days
            if state == "canceled":
                enqueue_mail(session, workspace.id, f"canceled:{sub_id}", "canceled")
        workspace.billing_state, workspace.grace_until = state, None
    session.flush()
    return workspace.billing_state


def record_invoice(session: Session, invoice: dict, paid: bool) -> None:
    customer = ref(invoice.get("customer"))
    account = session.scalar(select(BillingAccount).where(BillingAccount.customer_id == customer))
    if account is None:
        log.warning("Stripe invoice for an unknown customer")
        return
    workspace_id, invoice_id = account.workspace_id, invoice["id"]
    existing = session.get(BillingPayment, invoice_id)
    profile = session.get(BillingProfile, workspace_id)
    snapshot = (
        {
            k: getattr(profile, k)
            for k in (
                "legal_name",
                "vat",
                "tax_code",
                "address",
                "zip",
                "city",
                "province",
                "country",
                "sdi_code",
                "pec",
            )
        }  # fmt: skip
        if profile
        else None
    )
    transitions = invoice.get("status_transitions") or {}
    row = existing or BillingPayment(invoice_id=invoice_id, workspace_id=workspace_id)
    row.amount_cents = int(invoice.get("amount_paid") if paid else invoice.get("amount_due") or 0)
    row.currency = (invoice.get("currency") or "eur")[:3]
    row.status = "paid" if paid else "failed"
    row.plan_id = account.plan_id
    row.document_url = invoice.get("hosted_invoice_url")
    row.paid_at = ts(transitions.get("paid_at")) or (now() if paid else None)
    if existing is None or existing.profile is None:
        row.profile = snapshot
    if existing is None:
        session.add(row)
    enqueue_mail(session, workspace_id, f"{'paid' if paid else 'failed'}:{invoice_id}",
                 "payment_ok" if paid else "payment_failed")  # fmt: skip


def handle_event(session: Session, event: dict) -> str:
    """Apply one verified event. Returns "done" or "ignored"."""
    kind, obj = event["type"], event["data"]["object"]
    if kind in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        apply_subscription(session, obj)
    elif kind == "checkout.session.completed":
        if obj.get("mode") != "subscription" or not obj.get("subscription"):
            return "ignored"
        from . import gateway

        sub = gateway.retrieve_subscription(ref(obj["subscription"]))
        sub.setdefault("metadata", {}).setdefault(
            "workspace_id", (obj.get("metadata") or {}).get("workspace_id")
        )
        apply_subscription(session, sub)
    elif kind == "invoice.paid":
        record_invoice(session, obj, paid=True)
    elif kind == "invoice.payment_failed":
        record_invoice(session, obj, paid=False)
    else:
        return "ignored"
    return "done"
