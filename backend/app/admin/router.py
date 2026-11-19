"""Minimal admin area: workspaces (plan assignment, suspension) and plan limits.

platform_admin may read; only super_admin may write.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..access import workspace_access
from ..auth.deps import Auth, admin_reader, admin_writer
from ..auth.service import audit
from ..core.database import get_session
from ..core.security import now
from ..models import Company, CompanyTransfer, Plan, QrCode, User, Workspace
from ..plans import features_of
from ..quotas import usage
from ..schemas.admin import AssignPlan, PlanUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


def plan_out(plan: Plan) -> dict:
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "max_qr_static": plan.max_qr_static,
        "max_dynamic_qr": plan.max_dynamic_qr,
        "max_companies": plan.max_companies,
        "features": features_of(plan).model_dump(),
        "position": plan.position,
    }


def workspace_out(session: Session, workspace: Workspace, owner: User, detail=False) -> dict:
    data = {
        "id": workspace.id,
        "name": workspace.name,
        "owner": {"id": owner.id, "display_name": owner.display_name, "email": owner.email},
        "plan_id": workspace.plan_id,
        "status": workspace.status,
        "access": workspace_access(workspace),
        "trial_ends_at": workspace.trial_ends_at,
        "suspended_at": workspace.suspended_at,
        "created_at": workspace.created_at,
    }
    if detail:
        data["usage"] = usage(session, workspace)
    return data


def load_workspace(session: Session, workspace_id: int, lock=False) -> tuple[Workspace, User]:
    workspace = session.get(Workspace, workspace_id, with_for_update=lock)
    if workspace is None:
        raise HTTPException(404, "Spazio di lavoro non trovato.")
    return workspace, session.get(User, workspace.owner_user_id)


@router.get("/workspaces")
def list_workspaces(
    search: str = Query(default="", max_length=120),
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    query = select(Workspace, User).join(User, User.id == Workspace.owner_user_id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(Workspace.name.ilike(term), User.email.ilike(term)))
    rows = session.execute(query.order_by(Workspace.created_at.desc()).limit(500)).all()
    counts = dict(
        session.execute(
            select(QrCode.workspace_id, func.count())
            .where(QrCode.deleted_at.is_(None))
            .group_by(QrCode.workspace_id)
        ).all()
    )
    return [
        {**workspace_out(session, ws, owner), "qr_count": counts.get(ws.id, 0)}
        for ws, owner in rows
    ]


@router.get("/workspaces/{workspace_id}")
def get_workspace(
    workspace_id: int, _: Auth = Depends(admin_reader), session: Session = Depends(get_session)
):
    workspace, owner = load_workspace(session, workspace_id)
    return workspace_out(session, workspace, owner, detail=True)


@router.put("/workspaces/{workspace_id}/plan")
def assign_plan(
    workspace_id: int,
    payload: AssignPlan,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    if session.get(Plan, payload.plan_id) is None:
        raise HTTPException(404, "Piano non trovato.")
    workspace, owner = load_workspace(session, workspace_id, lock=True)
    previous = workspace.plan_id
    workspace.plan_id = payload.plan_id
    workspace.trial_ends_at = None  # assigning a plan ends the trial
    if workspace.billing_state in ("canceled", "unpaid", "past_due"):
        # An admin decision overrides a lapsed subscription: access and redirects come back.
        workspace.billing_state = workspace.grace_until = workspace.redirects_until = None
    audit(
        session,
        auth.user,
        "admin.plan_assigned",
        workspace.id,
        previous=previous,
        plan=payload.plan_id,
    )
    session.commit()
    return workspace_out(session, workspace, owner, detail=True)


@router.post("/workspaces/{workspace_id}/{action}")
def change_status(
    workspace_id: int,
    action: str,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    if action not in ("suspend", "reactivate"):
        raise HTTPException(404, "Operazione non disponibile.")
    workspace, owner = load_workspace(session, workspace_id, lock=True)
    workspace.status = "suspended" if action == "suspend" else "active"
    workspace.suspended_at = now() if action == "suspend" else None
    audit(session, auth.user, f"admin.workspace_{action}", workspace.id)
    session.commit()
    return workspace_out(session, workspace, owner, detail=True)


@router.get("/plans")
def list_plans(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    return [plan_out(p) for p in session.scalars(select(Plan).order_by(Plan.position))]


@router.put("/plans/{plan_id}")
def update_plan(
    plan_id: str,
    payload: PlanUpdate,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    plan = session.get(Plan, plan_id, with_for_update=True)
    if plan is None:
        raise HTTPException(404, "Piano non trovato.")
    data = payload.model_dump()
    for field, value in data.items():
        setattr(plan, field, value)
    audit(session, auth.user, "admin.plan_updated", plan=plan_id)
    session.commit()
    return plan_out(plan)


@router.get("/company-transfers")
def list_transfers(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    rows = session.execute(
        select(CompanyTransfer, Company)
        .join(Company, Company.id == CompanyTransfer.company_id)
        .order_by(CompanyTransfer.created_at.desc())
        .limit(500)
    ).all()
    names = dict(session.execute(select(Workspace.id, Workspace.name)).all())
    return [
        {
            "id": t.id,
            "company": company.name,
            "from_workspace": {"id": t.from_workspace_id, "name": names.get(t.from_workspace_id)},
            "to_workspace": {"id": t.to_workspace_id, "name": names.get(t.to_workspace_id)},
            "to_email": t.to_email,
            "status": t.status,
            "failure_reason": t.failure_reason,
            "created_at": t.created_at,
            "decided_at": t.decided_at,
        }
        for t, company in rows
    ]
