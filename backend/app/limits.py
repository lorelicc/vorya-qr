"""Read-only elements above the plan limits (0.5 "QR always on" guarantee).

Nothing is ever switched off for money: links, pages and files keep working. When a workspace is
above the limits of its current plan (typically after a trial ends and it lands on Free), the
elements beyond the limits are LOCKED for editing only. The choice is deterministic: the oldest
fit, the newest are locked. Upgrading, or deleting other elements, unlocks them at once.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .core.errors import CodedError
from .models import Company, QrCode
from .plans import effective_types, features_of, plan_of

READ_ONLY = "read_only_over_limit"


def locked_qr_ids(session: Session, workspace) -> dict[int, str]:
    """{qr_id: reason} for the dynamic codes that cannot be edited under the current plan."""
    plan = plan_of(session, workspace)
    if plan is None:
        return {}
    max_companies, per_company = plan.max_companies, plan.max_dynamic_qr
    types = set(effective_types(features_of(plan)))
    rows = session.execute(
        select(QrCode.id, QrCode.company_id, QrCode.qr_type)
        .where(
            QrCode.workspace_id == workspace.id,
            QrCode.kind == "dynamic",
            QrCode.deleted_at.is_(None),
        )
        .order_by(QrCode.created_at, QrCode.id)
    ).all()
    if not rows:
        return {}
    company_order = list(
        session.scalars(
            select(Company.id)
            .where(Company.workspace_id == workspace.id, Company.deleted_at.is_(None))
            .order_by(Company.created_at, Company.id)
        )
    )
    over_companies = set(company_order[max_companies:]) if max_companies is not None else set()
    seen: dict[int, int] = {}
    locked: dict[int, str] = {}
    for qr_id, company_id, qr_type in rows:
        if company_id in over_companies:
            locked[qr_id] = "company"
            continue
        seen[company_id] = seen.get(company_id, 0) + 1
        if per_company is not None and seen[company_id] > per_company:
            locked[qr_id] = "quota"
        elif qr_type not in types:
            locked[qr_id] = "type"
    return locked


def reason_text(reason: str, plan_name: str) -> str:
    return {
        "company": f"Questa azienda è oltre il limite del piano {plan_name}.",
        "quota": f"Il piano {plan_name} include meno codici dinamici per azienda: questo è in "
        "sola lettura.",
        "type": f"Il tipo di questo codice non è incluso nel piano {plan_name}.",
    }.get(reason, "In sola lettura.")


def ensure_editable(session: Session, workspace, qr: QrCode) -> None:
    if qr.kind != "dynamic":
        return
    reason = locked_qr_ids(session, workspace).get(qr.id)
    if reason:
        plan = plan_of(session, workspace)
        raise CodedError(
            403,
            f"{reason_text(reason, plan.name)} Funziona ancora e continua a essere "
            "raggiungibile, ma per modificarlo passa a un piano superiore o elimina altri "
            "codici.",
            READ_ONLY,
        )


def company_locked(session: Session, workspace, company_id: int) -> bool:
    """True if the company is beyond the plan's company limit (oldest companies fit)."""
    plan = plan_of(session, workspace)
    if plan is None or plan.max_companies is None:
        return False
    order = list(
        session.scalars(
            select(Company.id)
            .where(Company.workspace_id == workspace.id, Company.deleted_at.is_(None))
            .order_by(Company.created_at, Company.id)
        )
    )
    return company_id in order[plan.max_companies :]
