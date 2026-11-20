"""Worker jobs for billing; registered from app.worker (idempotent, commit-per-job)."""

from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import now
from ..models import BillingAccount, Workspace
from . import gateway, service
from .mail import send_pending


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


def expire_grants(session: Session) -> int:
    """A gift that ended behaves like an ended trial (dashboard blocked, redirects kept N days)."""
    result = session.execute(
        update(Workspace)
        .where(Workspace.grant_until.is_not(None), Workspace.grant_until <= now())
        .values(trial_ends_at=Workspace.grant_until, grant_until=None)
    )
    return result.rowcount


def onboarding_emails(session: Session) -> int:
    """Activation emails: day 1 (no dynamic QR yet: quick guide) and day 3 (discover the pages).

    Windows are bounded (7/10 days) so a first run never writes to old accounts. Each mail has a
    unique key (sent once) and respects the owner's preference (checked again when sending).
    """
    from sqlalchemy import exists

    from ..models import QrCode, User

    at, queued = now(), 0
    for kind, days, window in (("onboard_1d", 1, 7), ("onboard_3d", 3, 10)):
        rows = session.execute(
            select(Workspace.id, User.id)
            .join(User, User.id == Workspace.owner_user_id)
            .where(
                User.is_active.is_(True),
                User.email_verified_at <= at - timedelta(days=days),
                User.email_verified_at > at - timedelta(days=window),
                Workspace.status == "active",
                ~exists().where(
                    QrCode.workspace_id == Workspace.id,
                    QrCode.kind == "dynamic",
                    QrCode.deleted_at.is_(None),
                )
                if kind == "onboard_1d"
                else Workspace.id.is_not(None),
            )
        ).all()
        for workspace_id, user_id in rows:
            service.enqueue_mail(session, workspace_id, f"{kind}:{user_id}", kind)
            queued += 1
    return queued
