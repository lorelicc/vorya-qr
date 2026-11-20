"""Dynamic codes above the plan limits.

Rule (0.6, decided by the product owner): when a workspace is above the limits of its current plan
(typically after a trial ends or a subscription is cancelled and it lands on Free) only the codes
that FIT the plan stay active. The oldest fit; the newest are SUSPENDED: scans show the Vorya
"QR non attivo" page and the code cannot be edited. Nothing is deleted: upgrading, or deleting
other codes, reactivates them at once. Static codes carry their content in the image and are never
affected. A code whose TYPE is not in the plan stays active but read-only.
"""

import time

from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from .core.errors import CodedError
from .models import Company, Plan, QrCode
from .plans import effective_plan_id, effective_types, features_of, plan_of

READ_ONLY = "read_only_over_limit"
# Reasons that suspend the code (scans stop); "type" only makes it read-only.
SUSPENDING = ("company", "quota")

_LIMITS: dict[str, tuple[float, tuple[int | None, int | None]]] = {}
_VERDICTS: dict[int, tuple[float, str | None]] = {}
LIMITS_TTL, VERDICT_TTL = 30.0, 15.0


def _plan_limits(session: Session, plan_id: str) -> tuple[int | None, int | None]:
    """(max_companies, dynamic codes per company) of a plan, cached for 30 s (tiny table)."""
    at = time.monotonic()
    hit = _LIMITS.get(plan_id)
    if hit and hit[0] > at:
        return hit[1]
    plan = session.get(Plan, plan_id)
    value = (plan.max_companies, plan.max_dynamic_qr) if plan else (None, None)
    _LIMITS[plan_id] = (at + LIMITS_TTL, value)
    return value


def clear_caches() -> None:
    _LIMITS.clear()
    _VERDICTS.clear()


def verdict_from_ranks(
    kind: str,
    max_companies: int | None,
    per_company: int | None,
    company_rank: int,
    qr_rank: int,
) -> str | None:
    """Pure rule. Ranks are the number of OLDER companies in the workspace / older dynamic codes in
    the company, so the oldest fit and the newest are suspended."""
    if kind != "dynamic":
        return None
    if max_companies is not None and company_rank >= max_companies:
        return "company"
    if per_company is not None and qr_rank >= per_company:
        return "quota"
    return None


def suspension_reason(session: Session, workspace, company, qr) -> str | None:
    """Why a dynamic code does not answer scans because of the plan, or None if it does.

    Used by the redirect hot path: plan limits and the verdict are cached for a few seconds and an
    unlimited plan (Agency) costs no query. Same ordering as locked_qr_ids: oldest first.
    """
    if qr.kind != "dynamic":
        return None
    at = time.monotonic()
    hit = _VERDICTS.get(qr.id)
    if hit and hit[0] > at:
        return hit[1]
    max_companies, per_company = _plan_limits(session, effective_plan_id(workspace))
    verdict = None
    if (
        max_companies is not None
        and session.scalar(
            select(func.count())
            .select_from(Company)
            .where(
                Company.workspace_id == workspace.id,
                Company.deleted_at.is_(None),
                tuple_(Company.created_at, Company.id) < tuple_(company.created_at, company.id),
            )
        )
        >= max_companies
    ):
        verdict = "company"
    elif (
        per_company is not None
        and session.scalar(
            select(func.count())
            .select_from(QrCode)
            .where(
                QrCode.company_id == company.id,
                QrCode.kind == "dynamic",
                QrCode.deleted_at.is_(None),
                tuple_(QrCode.created_at, QrCode.id) < tuple_(qr.created_at, qr.id),
            )
        )
        >= per_company
    ):
        verdict = "quota"
    if len(_VERDICTS) > 20000:
        _VERDICTS.clear()
    _VERDICTS[qr.id] = (at + VERDICT_TTL, verdict)
    return verdict


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
        "company": f"Questa azienda è oltre il limite del piano {plan_name}: i suoi codici "
        "dinamici sono sospesi.",
        "quota": f"Il piano {plan_name} include meno codici dinamici per azienda: questo è "
        "sospeso.",
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
            f"{reason_text(reason, plan.name)} "
            + (
                "Chi lo scansiona vede «QR non attivo». Per riattivarlo passa a un piano "
                "superiore o elimina altri codici."
                if reason in SUSPENDING
                else "Resta attivo, ma per modificarlo passa a un piano superiore."
            ),
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
