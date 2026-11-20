"""Admin 0.4: customers first. List with billing status, a detail page (billing data, subscription,
payments, gifts, linked companies) and plan/month grants ("omaggi").

platform_admin may read; only super_admin may write.
"""

import calendar
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..access import workspace_access
from ..auth.deps import Auth, admin_reader, admin_writer
from ..auth.service import audit
from ..billing.service import account_of, enqueue_mail
from ..core.database import get_session
from ..core.security import now
from ..models import (
    BillingAccount,
    BillingPayment,
    BillingProfile,
    Company,
    Plan,
    PlanGrant,
    QrCode,
    User,
    Workspace,
)
from ..quotas import usage

router = APIRouter(prefix="/api/admin/clients", tags=["admin-clients"])
PROFILE_FIELDS = (
    "legal_name", "vat", "tax_code", "address", "zip", "city",
    "province", "country", "sdi_code", "pec",
)  # fmt: skip


class GrantIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: str = Field(pattern=r"^[a-z0-9_-]{1,24}$")
    months: int = Field(ge=1, le=36)
    note: str = Field(default="", max_length=300)


def add_months(start: datetime, months: int) -> datetime:
    """Calendar months (31 Jan + 1 month = 28/29 Feb), not 30-day blocks."""
    index = start.month - 1 + months
    year, month = start.year + index // 12, index % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return start.replace(year=year, month=month, day=day)


def billing_state(workspace: Workspace) -> str:
    access = workspace_access(workspace)
    if workspace.grant_until and workspace.grant_until > now():
        return "gift"
    if workspace.billing_state in ("active", "past_due", "canceled", "unpaid"):
        return workspace.billing_state
    return {"trial": "trialing", "free": "free"}.get(access, "none")


@router.get("")
def list_clients(
    search: str = Query(default="", max_length=120),
    plan: str = Query(default="", max_length=24),
    state: str = Query(default="", max_length=16),
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    query = (
        select(Workspace, User, BillingProfile)
        .join(User, User.id == Workspace.owner_user_id)
        .outerjoin(BillingProfile, BillingProfile.workspace_id == Workspace.id)
    )
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Workspace.name.ilike(term),
                User.email.ilike(term),
                User.display_name.ilike(term),
                BillingProfile.legal_name.ilike(term),
                BillingProfile.vat.ilike(term),
                BillingProfile.tax_code.ilike(term),
            )
        )
    if plan:
        query = query.where(Workspace.plan_id == plan)
    rows = session.execute(query.order_by(Workspace.created_at.desc()).limit(500)).all()
    ids = [w.id for w, _, _ in rows]
    companies = dict(
        session.execute(
            select(Company.workspace_id, func.count())
            .where(Company.workspace_id.in_(ids), Company.deleted_at.is_(None))
            .group_by(Company.workspace_id)
        ).all()
    )
    codes = dict(
        session.execute(
            select(QrCode.workspace_id, func.count())
            .where(QrCode.workspace_id.in_(ids), QrCode.deleted_at.is_(None))
            .group_by(QrCode.workspace_id)
        ).all()
    )
    out = []
    for w, owner, profile in rows:
        current = billing_state(w)
        if state and state != current and not (state == "suspended" and w.status == "suspended"):
            continue
        out.append(
            {
                "id": w.id,
                "name": w.name,
                "owner": {"display_name": owner.display_name, "email": owner.email},
                "plan_id": w.plan_id,
                "status": w.status,
                "access": workspace_access(w),
                "billing_state": current,
                "grant_until": w.grant_until,
                "trial_ends_at": w.trial_ends_at,
                "billing_complete": profile is not None,
                "legal_name": profile.legal_name if profile else None,
                "vat": profile.vat if profile else None,
                "tax_code": profile.tax_code if profile else None,
                "companies": companies.get(w.id, 0),
                "codes": codes.get(w.id, 0),
                "created_at": w.created_at,
            }
        )
    return out


def grant_out(g: PlanGrant) -> dict:
    return {
        "id": g.id,
        "plan_id": g.plan_id,
        "months": g.months,
        "starts_at": g.starts_at,
        "ends_at": g.ends_at,
        "note": g.note,
        "revoked_at": g.revoked_at,
        "created_at": g.created_at,
    }


def client_detail(session: Session, workspace_id: int) -> dict:
    w = session.get(Workspace, workspace_id)
    if w is None:
        raise HTTPException(404, "Cliente non trovato.")
    owner = session.get(User, w.owner_user_id)
    profile = session.get(BillingProfile, w.id)
    account = session.get(BillingAccount, w.id)
    payments = session.scalars(
        select(BillingPayment)
        .where(BillingPayment.workspace_id == w.id)
        .order_by(BillingPayment.created_at.desc())
        .limit(12)
    )
    grants = session.scalars(
        select(PlanGrant).where(PlanGrant.workspace_id == w.id).order_by(PlanGrant.id.desc())
    )
    qr_counts = dict(
        session.execute(
            select(QrCode.company_id, func.count())
            .where(QrCode.workspace_id == w.id, QrCode.deleted_at.is_(None))
            .group_by(QrCode.company_id)
        ).all()
    )
    companies = session.scalars(
        select(Company).where(Company.workspace_id == w.id).order_by(Company.created_at)
    )
    return {
        "id": w.id,
        "name": w.name,
        "owner": {
            "id": owner.id,
            "display_name": owner.display_name,
            "email": owner.email,
            "last_login_at": owner.last_login_at,
        },
        "plan_id": w.plan_id,
        "status": w.status,
        "access": workspace_access(w),
        "billing_state": billing_state(w),
        "trial_ends_at": w.trial_ends_at,
        "grant_until": w.grant_until,
        "suspended_at": w.suspended_at,
        "created_at": w.created_at,
        "usage": usage(session, w),
        "profile": {f: getattr(profile, f) for f in PROFILE_FIELDS} if profile else None,
        "subscription": {
            "customer_id": account.customer_id,
            "subscription_id": account.subscription_id,
            "cycle": account.cycle,
            "period_end": account.period_end,
            "cancel_at_period_end": account.cancel_at_period_end,
        }
        if account
        else None,
        "payments": [
            {
                "id": p.invoice_id,
                "amount_cents": p.amount_cents,
                "currency": p.currency,
                "status": p.status,
                "paid_at": p.paid_at,
            }
            for p in payments
        ],
        "grants": [grant_out(g) for g in grants],
        "companies": [
            {
                "id": c.id,
                "name": c.name,
                "sector": c.sector,
                "status": "deleted" if c.deleted_at else c.status,
                "codes": qr_counts.get(c.id, 0),
                "created_at": c.created_at,
                "deleted_at": c.deleted_at,
            }
            for c in companies
        ],
    }


@router.get("/{client_id}")
def get_client(
    client_id: int, _: Auth = Depends(admin_reader), session: Session = Depends(get_session)
):
    return client_detail(session, client_id)


@router.post("/{client_id}/grants", status_code=201)
def give_plan(
    client_id: int,
    payload: GrantIn,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    """Gift N months of a plan. Stacks on a running gift; refused while a paid plan is live."""
    if session.get(Plan, payload.plan_id) is None:
        raise HTTPException(404, "Piano non trovato.")
    w = session.get(Workspace, client_id, with_for_update=True)
    if w is None:
        raise HTTPException(404, "Cliente non trovato.")
    if w.billing_state in ("active", "past_due"):
        raise HTTPException(
            409,
            "Il cliente ha un abbonamento attivo: l'omaggio non può sovrapporsi a un piano pagato.",
        )
    at = now()
    running = w.grant_until if w.grant_until and w.grant_until > at else None
    start = running or at
    grant = PlanGrant(
        workspace_id=w.id,
        plan_id=payload.plan_id,
        months=payload.months,
        starts_at=start,
        ends_at=add_months(start, payload.months),
        note=payload.note.strip(),
        previous_plan_id=w.plan_id,
        granted_by=auth.user.id,
    )
    session.add(grant)
    session.flush()
    w.plan_id, w.trial_ends_at = payload.plan_id, None
    w.billing_state, w.grace_until, w.redirects_until = None, None, None
    w.grant_until = grant.ends_at
    account_of(session, w.id)
    enqueue_mail(session, w.id, f"gift:{grant.id}", "gift")
    audit(session, auth.user, "admin.plan_gift", w.id, plan=payload.plan_id, months=payload.months)
    session.commit()
    return client_detail(session, w.id)


@router.post("/{client_id}/grants/{grant_id}/revoke")
def revoke_grant(
    client_id: int,
    grant_id: int,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    """Ends the gift now: the account goes back to the plan it had, with the expired-trial rules."""
    grant = session.get(PlanGrant, grant_id)
    w = session.get(Workspace, client_id, with_for_update=True)
    if grant is None or w is None or grant.workspace_id != w.id:
        raise HTTPException(404, "Omaggio non trovato.")
    if grant.revoked_at:
        raise HTTPException(409, "Omaggio già revocato.")
    at = now()
    grant.revoked_at = at
    if w.grant_until and w.grant_until > at:
        w.grant_until, w.trial_ends_at = None, at
        if grant.previous_plan_id:
            w.plan_id = grant.previous_plan_id
    audit(session, auth.user, "admin.plan_gift_revoked", w.id, grant=grant.id)
    session.commit()
    return client_detail(session, w.id)
