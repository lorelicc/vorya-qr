"""Plan limits. Creation locks the workspace row (SELECT ... FOR UPDATE) until commit, so two
concurrent requests can never both take the last slot.

If an admin assigns a plan below current usage nothing is disabled: creation of that kind is
simply refused until the workspace is back within the limit (`over_limit` in the usage).
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .core.errors import QuotaExceeded
from .models import Plan, QrCode, Workspace

KINDS = ("static", "dynamic")
LIMIT_FIELD = {"static": "max_qr_static", "dynamic": "max_dynamic_qr"}
LABEL = {"static": "QR statici", "dynamic": "QR dinamici"}


def _counts(session: Session, workspace_id: int) -> dict[str, int]:
    rows = session.execute(
        select(QrCode.kind, func.count())
        .where(QrCode.workspace_id == workspace_id, QrCode.deleted_at.is_(None))
        .group_by(QrCode.kind)
    ).all()
    counts = dict.fromkeys(KINDS, 0)
    counts.update({kind: count for kind, count in rows})
    return counts


def usage(session: Session, workspace: Workspace) -> dict[str, dict]:
    plan = session.get(Plan, workspace.plan_id)
    counts = _counts(session, workspace.id)
    result = {}
    for kind in KINDS:
        limit = getattr(plan, LIMIT_FIELD[kind]) if plan else 0
        used = counts[kind]
        result[kind] = {
            "used": used,
            "limit": limit,
            "over_limit": limit is not None and used > limit,
            "can_create": limit is None or used < limit,
        }
    return result


def reserve_slot(session: Session, workspace_id: int, kind: str) -> Workspace:
    workspace = session.scalar(
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    plan = session.get(Plan, workspace.plan_id)
    limit = getattr(plan, LIMIT_FIELD[kind]) if plan else 0
    if limit is None:
        return workspace
    used = _counts(session, workspace_id)[kind]
    if used > limit:
        raise QuotaExceeded(
            f"Hai più {LABEL[kind]} di quanti ne preveda il piano attuale ({used} su {limit}). "
            "Elimina qualche QR o contattaci per cambiare piano.",
            f"quota_{kind}",
        )
    if used >= limit:
        raise QuotaExceeded(
            f"Hai raggiunto il numero massimo di {LABEL[kind]} previsto dal tuo piano "
            f"({limit}). Contattaci per passare a un piano superiore.",
            f"quota_{kind}",
        )
    return workspace
