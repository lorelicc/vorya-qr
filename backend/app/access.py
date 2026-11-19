"""Single source of truth for whether a workspace may use the app.

States:
- active:        plan assigned by an admin, no trial running.
- trial:         trial running (Pro limits).
- trial_expired: trial over and no plan assigned yet. Dashboard and user API are
                 blocked, but dynamic QR redirects keep working and keep counting scans.
- suspended:     manual suspension by an admin. Everything is blocked, redirects included.
"""

from datetime import datetime

from .core.errors import AccessBlocked
from .core.security import now
from .models import Workspace

ACTIVE, TRIAL, TRIAL_EXPIRED, SUSPENDED = "active", "trial", "trial_expired", "suspended"
BLOCKED_STATES = (TRIAL_EXPIRED, SUSPENDED)


def workspace_access(workspace: Workspace, at: datetime | None = None) -> str:
    if workspace.status == "suspended":
        return SUSPENDED
    if workspace.trial_ends_at is not None:
        return TRIAL_EXPIRED if workspace.trial_ends_at <= (at or now()) else TRIAL
    return ACTIVE


def ensure_usable(workspace: Workspace) -> str:
    state = workspace_access(workspace)
    if state in BLOCKED_STATES:
        raise AccessBlocked(state)
    return state


def redirects_enabled(workspace_status: str) -> bool:
    """Redirects only care about manual suspension, so they need no trial lookup."""
    return workspace_status != "suspended"
