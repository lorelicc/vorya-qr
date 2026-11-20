"""Plan limits. Companies, static codes and storage are TOTAL per workspace; since 0.5 the dynamic
codes limit (`max_dynamic_qr`) is PER COMPANY. Every check locks the workspace row
(SELECT ... FOR UPDATE) until commit, so two concurrent requests can never both take the last
slot. If an admin assigns a plan below current usage nothing is disabled: creation of that
resource is simply refused until the workspace is back within the limit.
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .core.errors import QuotaExceeded
from .models import Company, Plan, QrCode, Workspace
from .plans import plan_of

KINDS = ("static", "dynamic")
LIMIT_FIELD = {"static": "max_qr_static", "dynamic": "max_dynamic_qr"}
LABEL = {"static": "QR statici", "dynamic": "QR dinamici", "company": "aziende"}


def dynamic_per_company(session: Session, workspace_id: int) -> dict[int, int]:
    rows = session.execute(
        select(QrCode.company_id, func.count())
        .where(
            QrCode.workspace_id == workspace_id,
            QrCode.kind == "dynamic",
            QrCode.deleted_at.is_(None),
        )
        .group_by(QrCode.company_id)
    ).all()
    return dict(rows)


@dataclass
class Counts:
    static: int = 0
    dynamic: int = 0
    companies: int = 0
    storage_bytes: int = 0


def lock_workspace(session: Session, workspace_id: int) -> Workspace:
    return session.scalar(
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def counts(session: Session, workspace_id: int) -> Counts:
    result = Counts()
    for kind, count in session.execute(
        select(QrCode.kind, func.count())
        .where(QrCode.workspace_id == workspace_id, QrCode.deleted_at.is_(None))
        .group_by(QrCode.kind)
    ):
        setattr(result, kind, count)
    result.companies = session.scalar(
        select(func.count())
        .select_from(Company)
        .where(Company.workspace_id == workspace_id, Company.deleted_at.is_(None))
    )
    from .storage.usage import storage_used  # local import: storage depends on models only

    result.storage_bytes = storage_used(session, workspace_id)
    return result


def limits(plan: Plan | None) -> dict[str, int | None]:
    from .plans import features_of

    features = features_of(plan)
    return {
        "static": plan.max_qr_static if plan else 0,
        "dynamic": plan.max_dynamic_qr if plan else 0,
        "company": plan.max_companies if plan else 0,
        "storage_bytes": None if features.storage_mb is None else features.storage_mb * 1024 * 1024,
    }


def _item(used: int, limit: int | None) -> dict:
    return {
        "used": used,
        "limit": limit,
        "over_limit": limit is not None and used > limit,
        "can_create": limit is None or used < limit,
    }


def usage(session: Session, workspace: Workspace) -> dict[str, dict]:
    plan = plan_of(session, workspace)
    current, maximum = counts(session, workspace.id), limits(plan)
    fullest = max(dynamic_per_company(session, workspace.id).values(), default=0)
    return {
        "static": _item(current.static, maximum["static"]),
        # per company: shows the fullest company against the per-company limit
        "dynamic": {**_item(fullest, maximum["dynamic"]), "per_company": True},
        "companies": _item(current.companies, maximum["company"]),
        "storage": _item(current.storage_bytes, maximum["storage_bytes"]),
    }


def _check(used: int, limit: int | None, label: str, code: str, extra: int = 1) -> None:
    if limit is None:
        return
    if used > limit:
        raise QuotaExceeded(
            f"Hai più {label} di quanti ne preveda il piano attuale ({used} su {limit}). "
            "Eliminane qualcuno o contattaci per cambiare piano.",
            code,
        )
    if used + extra > limit:
        raise QuotaExceeded(
            f"Hai raggiunto il numero massimo di {label} previsto dal tuo piano ({limit}). "
            "Contattaci per passare a un piano superiore.",
            code,
        )


def reserve_slot(
    session: Session, workspace_id: int, kind: str, company_id: int | None = None
) -> Workspace:
    workspace = lock_workspace(session, workspace_id)
    plan = plan_of(session, workspace)
    if company_id is not None:
        from .limits import company_locked

        if company_locked(session, workspace, company_id):
            raise QuotaExceeded(
                "Questa azienda è oltre il limite del tuo piano ed è in sola lettura. "
                "Passa a un piano superiore per usarla.",
                "quota_companies",
            )
    if kind == "dynamic" and company_id is not None:
        used = dynamic_per_company(session, workspace_id).get(company_id, 0)
        label = "QR dinamici per azienda"
    else:
        used, label = counts(session, workspace_id).__dict__[kind], LABEL[kind]
    _check(used, limits(plan)[kind], label, f"quota_{kind}")
    return workspace


def reserve_company(session: Session, workspace_id: int) -> Workspace:
    workspace = lock_workspace(session, workspace_id)
    plan = plan_of(session, workspace)
    _check(counts(session, workspace_id).companies, limits(plan)["company"], LABEL["company"],
           "quota_companies")  # fmt: skip
    return workspace


def check_capacity(session: Session, workspace: Workspace, add: Counts) -> str | None:
    """For transfers: returns a human message if `add` does not fit, None otherwise.
    The caller must already hold the lock on `workspace`."""
    plan = plan_of(session, workspace)
    current, maximum = counts(session, workspace.id), limits(plan)
    checks = (
        ("company", current.companies, add.companies, "aziende"),
        ("static", current.static, add.static, "QR statici"),
        ("storage_bytes", current.storage_bytes, add.storage_bytes, "spazio di archiviazione"),
    )
    limit = maximum["dynamic"]  # per company: the moved company brings its own count
    if limit is not None and add.dynamic > limit:
        return "Il piano del destinatario non ha abbastanza QR dinamici per azienda."
    for key, used, extra, label in checks:
        limit = maximum[key]
        if limit is not None and extra and used + extra > limit:
            return f"Il piano del destinatario non ha abbastanza {label} per ricevere l'azienda."
    return None
