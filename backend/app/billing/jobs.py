"""Worker jobs for billing; registered from app.worker (idempotent, commit-per-job)."""

from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import now
from ..models import BillingAccount, Workspace
from . import gateway, service
from .mail import send_pending
from .settings import billing_settings


def trial_reminders(session: Session) -> int:
    """Trial ending: one mail 3 days before and one on the last day (never twice)."""
    at = now()
    rows = session.scalars(
        select(Workspace).where(
            Workspace.billing_state.is_(None),
            Workspace.status == "active",
            Workspace.trial_ends_at.is_not(None),
            Workspace.trial_ends_at > at - timedelta(days=1),
            Workspace.trial_ends_at <= at + timedelta(days=3),
        )
    )
    count = 0
    for w in rows:
        day = w.trial_ends_at.date().isoformat()
        service.enqueue_mail(session, w.id, f"trial3:{w.id}:{day}", "trial_3d")
        count += 1
        if w.trial_ends_at <= at + timedelta(days=1):
            service.enqueue_mail(session, w.id, f"trial0:{w.id}:{day}", "trial_0d")
    return count


def trial_redirect_windows(session: Session) -> int:
    """Expired trials keep their redirects for N days after the trial end, then go neutral."""
    days = timedelta(days=int(billing_settings(session)["redirect_days"]))
    at = now()
    result = session.execute(
        update(Workspace)
        .where(
            Workspace.trial_ends_at.is_not(None),
            Workspace.trial_ends_at <= at,
            Workspace.redirects_until.is_(None),
        )
        .values(redirects_until=Workspace.trial_ends_at + days)
    )
    return result.rowcount


def send_billing_mail(session: Session) -> int:
    return send_pending(session)


def reconcile_subscriptions(session: Session) -> int:
    """Safety net for lost webhooks: re-read stale subscriptions from Stripe."""
    if not gateway.configured() or (
        gateway.mode() == "live" and not get_settings().stripe_live_allowed
    ):
        return 0
    stale = session.scalars(
        select(BillingAccount)
        .where(
            BillingAccount.subscription_id.is_not(None),
            BillingAccount.updated_at < now() - timedelta(hours=6),
        )
        .order_by(BillingAccount.updated_at)
        .limit(20)
    )
    count = 0
    for account in list(stale):
        try:
            sub = gateway.retrieve_subscription(account.subscription_id)
            service.apply_subscription(session, sub)
            account.updated_at = now()
            count += 1
        except Exception:  # noqa: BLE001 - Stripe down: try again next cycle
            session.rollback()
            break
    return count
