"""Single source of truth for whether a workspace may use the app.

When a trial ends or a subscription lapses the workspace is simply on the Free plan (see
plans.effective_plan_id): the app stays usable, and only the dynamic codes that fit the plan keep
answering scans (see app/limits.py). States:
- trial:     trial running (Pro limits).
- active:    paid subscription, gift, or a plan assigned by an admin.
- free:      Free plan (trial ended / subscription cancelled or unpaid / gift ended).
- past_due:  renewal payment failed; the paid plan stays during the grace period.
- suspended: manual suspension by an admin (abuse, terms). Everything is blocked, redirects too.
"""

from datetime import datetime

from .core.errors import AccessBlocked
from .core.security import now
from .models import Workspace
from .plans import FREE_PLAN, effective_plan_id

ACTIVE, TRIAL, FREE, SUSPENDED, PAST_DUE = "active", "trial", "free", "suspended", "past_due"
# Statuses that switch everything off: abuse suspension and deleted (archived/purged) clients.
OFF_STATUSES = ("suspended", "archived", "purged")
BLOCKED_STATES = (SUSPENDED,)


def workspace_access(workspace: Workspace, at: datetime | None = None) -> str:
    at = at or now()
    if workspace.status in OFF_STATUSES:
        return SUSPENDED
    if workspace.billing_state == "past_due" and effective_plan_id(workspace, at) != FREE_PLAN:
        return PAST_DUE
    if effective_plan_id(workspace, at) == FREE_PLAN:
        return FREE
    if (
        workspace.trial_ends_at is not None
        and workspace.billing_state is None
        and workspace.grant_until is None
    ):
        return TRIAL
    return ACTIVE


def ensure_usable(workspace: Workspace) -> str:
    state = workspace_access(workspace)
    if state in BLOCKED_STATES:
        raise AccessBlocked(state)
    return state


def redirects_enabled(workspace_status: str) -> bool:
    """Workspace-level switch: only a manual suspension. Plan limits act per code (limits.py)."""
    return workspace_status not in OFF_STATUSES
