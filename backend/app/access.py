"""Single source of truth for whether a workspace may use the app.

States:
- active:        plan assigned by an admin, no trial running.
- trial:         trial running (Pro limits).
- trial_expired: trial over and no plan assigned yet. Dashboard and user API are
                 blocked, but dynamic QR redirects keep working and keep counting scans.
- suspended:     manual suspension by an admin. Everything is blocked, redirects included.
- past_due:      renewal payment failed; the app keeps working during the grace period.
- payment_blocked: subscription canceled/unpaid or grace over. Dashboard blocked; redirects keep
                 working until `redirects_until`, then "QR non attivo". Paying reactivates at once.
"""

from datetime import datetime

from .core.errors import AccessBlocked
from .core.security import now
from .models import Workspace

ACTIVE, TRIAL, TRIAL_EXPIRED, SUSPENDED = "active", "trial", "trial_expired", "suspended"
PAST_DUE, PAYMENT_BLOCKED = "past_due", "payment_blocked"
BLOCKED_STATES = (TRIAL_EXPIRED, SUSPENDED, PAYMENT_BLOCKED)


def workspace_access(workspace: Workspace, at: datetime | None = None) -> str:
    if workspace.status == "suspended":
        return SUSPENDED
    state, at = workspace.billing_state, at or now()
    if workspace.grant_until is not None:  # a gift from the team: active until it ends
        return ACTIVE if workspace.grant_until > at else TRIAL_EXPIRED
    if state in ("canceled", "unpaid"):
        return PAYMENT_BLOCKED
    if state == "past_due":
        return (
            PAYMENT_BLOCKED if workspace.grace_until and workspace.grace_until <= at else PAST_DUE
        )
    if workspace.trial_ends_at is not None:
        return TRIAL_EXPIRED if workspace.trial_ends_at <= at else TRIAL
    return ACTIVE


def ensure_usable(workspace: Workspace) -> str:
    state = workspace_access(workspace)
    if state in BLOCKED_STATES:
        raise AccessBlocked(state)
    return state


def redirects_enabled(workspace_status: str, redirects_until: datetime | None = None) -> bool:
    """Redirects stop on manual suspension, or once the post-expiry window has closed."""
    if workspace_status == "suspended":
        return False
    return redirects_until is None or redirects_until > now()
