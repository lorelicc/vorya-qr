"""Admin: add, edit, archive and restore clients; reset passwords; companies, QR codes, audit.

Only a super admin writes (platform admins read). Deleting a client ARCHIVES it for 30 days: it
cannot sign in, its subscription is cancelled, its QR codes show "QR non attivo" and their
addresses stay reserved. Within 30 days it can be restored; after that the worker anonymises the
personal data (see worker.purge_workspaces).
"""

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..auth.deps import Auth, admin_reader, admin_writer
from ..auth.onboarding import trial_settings
from ..auth.service import audit, issue_token, revoke_sessions
from ..billing import gateway
from ..billing.validation import BillingProfileIn
from ..companies.service import RESTORE_DAYS, create_default_company
from ..core.database import get_session
from ..core.security import normalized_email, now
from ..mail.templates import send_invitation, send_password_reset
from ..models import (
    AuditLog,
    BillingAccount,
    BillingProfile,
    Company,
    CompanyTransfer,
    Plan,
    QrCode,
    Registration,
    User,
    Workspace,
)
from .clients import client_detail

router = APIRouter(prefix="/api/admin/clients", tags=["admin-clients"])
INVITE_DAYS = 7


class ClientCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: EmailStr = Field(max_length=254)
    display_name: str = Field(min_length=2, max_length=160)
    workspace_name: str = Field(min_length=2, max_length=160)
    plan_id: str | None = Field(default=None, max_length=24)
    trial_days: int | None = Field(default=None, ge=0, le=365)

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return normalized_email(value)


class ClientPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    workspace_name: str | None = Field(default=None, min_length=2, max_length=160)
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    email: EmailStr | None = Field(default=None, max_length=254)
    profile: BillingProfileIn | None = None

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str | None) -> str | None:
        return normalized_email(value) if value else value


class Confirm(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_name: str = Field(min_length=1, max_length=160)


class QrAction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str = Field(default="", max_length=180)


def load(session: Session, client_id: int, *, lock: bool = False) -> tuple[Workspace, User]:
    query = select(Workspace).where(Workspace.id == client_id)
    if lock:
        query = query.with_for_update()
    workspace = session.scalar(query)
    if workspace is None:
        raise HTTPException(404, "Cliente non trovato.")
    return workspace, session.get(User, workspace.owner_user_id)


def editable(workspace: Workspace) -> None:
    if workspace.deleted_at is not None:
        raise HTTPException(409, "Il cliente è archiviato: ripristinalo prima di modificarlo.")


@router.post("", status_code=201)
def create_client(
    payload: ClientCreate,
    tasks: BackgroundTasks,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    if session.scalar(select(User.id).where(User.email == payload.email)):
        raise HTTPException(409, "Esiste già un account con questa email.")
    days, trial_plan = trial_settings(session)
    plan_id = payload.plan_id or trial_plan
    if session.get(Plan, plan_id) is None:
        raise HTTPException(422, f"Piano «{plan_id}» inesistente.")
    days = payload.trial_days if payload.trial_days is not None else days
    if plan_id == "free":
        days = 0
    user = User(
        email=payload.email,
        display_name=payload.display_name,
        role="company_admin",
        is_active=False,
    )
    session.add(user)
    session.flush()
    workspace = Workspace(
        name=payload.workspace_name, owner_user_id=user.id, plan_id=plan_id, status="active"
    )
    session.add(workspace)
    session.flush()
    company = create_default_company(session, workspace.id, workspace.name)
    user.last_company_id = company.id
    session.add(
        Registration(
            user_id=user.id,
            workspace_name=workspace.name,
            terms_accepted_at=None,  # accepted by the client, if at all, on first use
            invite={"plan_id": plan_id, "trial_days": days, "by": auth.user.id},
        )
    )
    token = issue_token(session, user, "verify", minutes=INVITE_DAYS * 24 * 60)
    audit(
        session, auth.user, "admin.client_created", workspace.id,
        email=payload.email, plan_id=plan_id, trial_days=days,
    )  # fmt: skip
    session.commit()
    tasks.add_task(
        send_invitation, user.email, user.display_name, workspace.name, token, INVITE_DAYS
    )
    return client_detail(session, workspace.id)


@router.patch("/{client_id}")
def edit_client(
    client_id: int,
    payload: ClientPatch,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    workspace, owner = load(session, client_id, lock=True)
    editable(workspace)
    changes: dict = {}
    if payload.workspace_name and payload.workspace_name != workspace.name:
        changes["workspace_name"] = [workspace.name, payload.workspace_name]
        workspace.name = payload.workspace_name
    if payload.display_name and payload.display_name != owner.display_name:
        changes["display_name"] = [owner.display_name, payload.display_name]
        owner.display_name = payload.display_name
    if payload.email and payload.email != owner.email:
        if session.scalar(select(User.id).where(User.email == payload.email, User.id != owner.id)):
            raise HTTPException(409, "Esiste già un account con questa email.")
        changes["email"] = [owner.email, payload.email]
        owner.email = payload.email
    if payload.profile is not None:
        profile = session.get(BillingProfile, workspace.id)
        data = payload.profile.model_dump()
        if profile is None:
            session.add(BillingProfile(workspace_id=workspace.id, **data))
        else:
            for field, value in data.items():
                setattr(profile, field, value)
        changes["billing_profile"] = True
    if not changes:
        return client_detail(session, workspace.id)
    audit(session, auth.user, "admin.client_edited", workspace.id, **changes)
    session.commit()
    return client_detail(session, workspace.id)


@router.post("/{client_id}/resend-invite", status_code=204)
def resend_invite(
    client_id: int,
    tasks: BackgroundTasks,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    workspace, owner = load(session, client_id, lock=True)
    editable(workspace)
    if owner.email_verified_at:
        raise HTTPException(409, "Il cliente ha già attivato l'account: usa il reset password.")
    token = issue_token(session, owner, "verify", minutes=INVITE_DAYS * 24 * 60)
    audit(session, auth.user, "admin.invite_resent", workspace.id)
    session.commit()
    tasks.add_task(
        send_invitation, owner.email, owner.display_name, workspace.name, token, INVITE_DAYS
    )


@router.post("/{client_id}/reset-password", status_code=204)
def reset_password(
    client_id: int,
    tasks: BackgroundTasks,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    workspace, owner = load(session, client_id, lock=True)
    editable(workspace)
    if not owner.email_verified_at:
        raise HTTPException(409, "Il cliente non ha ancora attivato l'account: reinvia l'invito.")
    token = issue_token(session, owner, "reset", minutes=30)
    audit(session, auth.user, "admin.password_reset_sent", workspace.id)
    session.commit()
    tasks.add_task(send_password_reset, owner.email, owner.display_name, token)


@router.post("/{client_id}/revoke-sessions", status_code=204)
def force_logout(
    client_id: int, auth: Auth = Depends(admin_writer), session: Session = Depends(get_session)
):
    workspace, owner = load(session, client_id)
    revoke_sessions(session, owner.id)
    audit(session, auth.user, "admin.sessions_revoked", workspace.id)
    session.commit()


@router.delete("/{client_id}", status_code=204)
def archive_client(
    client_id: int,
    payload: Confirm,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    workspace, owner = load(session, client_id, lock=True)
    if workspace.deleted_at is not None:
        raise HTTPException(409, "Il cliente è già archiviato.")
    if " ".join(payload.confirm_name.split()) != workspace.name:
        raise HTTPException(422, "Per confermare digita esattamente il nome del cliente.")
    if owner.id == auth.user.id:
        raise HTTPException(409, "Non puoi archiviare il tuo stesso account.")
    stamp = now()
    workspace.deleted_at, workspace.deleted_by = stamp, auth.user.id
    workspace.purge_after = stamp + timedelta(days=RESTORE_DAYS)
    workspace.status = "archived"
    owner.is_active = False
    revoke_sessions(session, owner.id)
    # Same stamp on the companies: a restore brings back exactly these, not older deletions.
    session.execute(
        update(Company)
        .where(Company.workspace_id == workspace.id, Company.deleted_at.is_(None))
        .values(deleted_at=stamp, purge_after=workspace.purge_after)
    )
    session.execute(
        update(CompanyTransfer)
        .where(
            or_(
                CompanyTransfer.from_workspace_id == workspace.id,
                CompanyTransfer.to_workspace_id == workspace.id,
            ),
            CompanyTransfer.status == "pending",
        )
        .values(status="cancelled", decided_at=stamp)
    )
    cancelled = None
    account = session.get(BillingAccount, workspace.id)
    if account and account.subscription_id and gateway.configured():
        try:
            gateway.cancel_subscription(account.subscription_id)
            cancelled = True
        except Exception as exc:  # noqa: BLE001 - the archive must not fail on Stripe
            cancelled = f"errore: {type(exc).__name__}"
    audit(
        session, auth.user, "admin.client_archived", workspace.id,
        email=owner.email, subscription_cancelled=cancelled,
    )  # fmt: skip
    session.commit()


@router.post("/{client_id}/restore")
def restore_client(
    client_id: int, auth: Auth = Depends(admin_writer), session: Session = Depends(get_session)
):
    workspace, owner = load(session, client_id, lock=True)
    if workspace.deleted_at is None:
        raise HTTPException(409, "Il cliente non è archiviato.")
    if workspace.status == "purged" or (workspace.purge_after and workspace.purge_after <= now()):
        raise HTTPException(
            410, "I 30 giorni sono passati: i dati personali sono stati cancellati."
        )
    session.execute(
        update(Company)
        .where(Company.workspace_id == workspace.id, Company.deleted_at == workspace.deleted_at)
        .values(deleted_at=None, purge_after=None)
    )
    workspace.deleted_at = workspace.purge_after = workspace.deleted_by = None
    workspace.status = "active"
    owner.is_active = owner.email_verified_at is not None
    audit(session, auth.user, "admin.client_restored", workspace.id)
    session.commit()
    return client_detail(session, workspace.id)


@router.post("/{client_id}/companies/{company_id}/{action}", status_code=204)
def company_action(
    client_id: int,
    company_id: int,
    action: Literal["delete", "restore"],
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    workspace, _ = load(session, client_id)
    editable(workspace)
    company = session.scalar(
        select(Company)
        .where(Company.id == company_id, Company.workspace_id == workspace.id)
        .with_for_update()
    )
    if company is None or company.status != "active":
        raise HTTPException(404, "Azienda non trovata.")
    if action == "delete":
        if company.deleted_at is not None:
            raise HTTPException(409, "L'azienda è già eliminata.")
        company.deleted_at = now()
        company.purge_after = now() + timedelta(days=RESTORE_DAYS)
        session.execute(
            update(User).where(User.last_company_id == company.id).values(last_company_id=None)
        )
    else:
        if company.deleted_at is None or not company.purge_after or company.purge_after <= now():
            raise HTTPException(409, "L'azienda non è recuperabile.")
        company.deleted_at = company.purge_after = None
    audit(session, auth.user, f"admin.company_{action}d", workspace.id, company_id=company.id)
    session.commit()


def qr_out(qr: QrCode, company: str) -> dict:
    return {
        "id": qr.id,
        "name": qr.name,
        "slug": qr.slug,
        "kind": qr.kind,
        "qr_type": qr.qr_type,
        "status": "deleted" if qr.deleted_at else qr.status,
        "blocked_reason": qr.blocked_reason,
        "company_id": qr.company_id,
        "company": company,
        "scan_total": qr.scan_total,
        "created_at": qr.created_at,
    }


@router.get("/{client_id}/qr-codes")
def list_qr(
    client_id: int,
    search: str = Query(default="", max_length=120),
    company_id: int | None = None,
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    load(session, client_id)
    query = (
        select(QrCode, Company.name)
        .join(Company, Company.id == QrCode.company_id)
        .where(QrCode.workspace_id == client_id)
    )
    if company_id:
        query = query.where(QrCode.company_id == company_id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(QrCode.name.ilike(term), QrCode.slug.ilike(term)))
    rows = session.execute(query.order_by(QrCode.created_at.desc()).limit(200)).all()
    total = session.scalar(
        select(func.count()).select_from(QrCode).where(QrCode.workspace_id == client_id)
    )
    return {"total": total, "items": [qr_out(q, name) for q, name in rows]}


@router.post("/{client_id}/qr-codes/{qr_id}/{action}", status_code=204)
def qr_action(
    client_id: int,
    qr_id: int,
    action: Literal["block", "unblock", "delete"],
    payload: QrAction,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    workspace, _ = load(session, client_id)
    qr = session.scalar(
        select(QrCode)
        .where(QrCode.id == qr_id, QrCode.workspace_id == workspace.id)
        .with_for_update()
    )
    if qr is None:
        raise HTTPException(404, "QR non trovato.")
    if action == "block":
        qr.status, qr.blocked_reason = "blocked", payload.note or "Bloccato dall'amministrazione"
    elif action == "unblock":
        if qr.status != "blocked":
            raise HTTPException(409, "Il QR non è bloccato.")
        qr.status, qr.blocked_reason = "active", None
    else:
        if qr.deleted_at is not None:
            raise HTTPException(409, "Il QR è già eliminato.")
        qr.deleted_at = now()  # the address stays reserved and shows "QR non attivo"
    audit(session, auth.user, f"admin.qr_{action}", workspace.id, qr_id=qr.id, note=payload.note)
    session.commit()


@router.get("/{client_id}/audit")
def client_audit(
    client_id: int,
    limit: int = Query(default=100, ge=1, le=500),
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    load(session, client_id)
    rows = session.execute(
        select(AuditLog, User.email)
        .outerjoin(User, User.id == AuditLog.actor_id)
        .where(AuditLog.workspace_id == client_id)
        .order_by(AuditLog.id.desc())
        .limit(limit)
    ).all()
    return [
        {
            "id": a.id,
            "action": a.action,
            "actor": email,
            "details": a.details,
            "created_at": a.created_at,
        }
        for a, email in rows
    ]
