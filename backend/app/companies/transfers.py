"""Company transfers between accounts.

Accepting is one transaction: both workspaces are locked in id order (no deadlocks), the
recipient must be usable (not suspended, trial not expired) and must have room for the
company, its QR codes and its files. Everything owned by the company moves with it; QR
codes keep their slug, so redirects never stop.
"""

from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..access import BLOCKED_STATES, workspace_access
from ..auth.deps import ClientContext, CompanyContext, client_context, owned_company
from ..auth.service import audit, rate_limit
from ..core.database import get_session
from ..core.errors import CodedError
from ..core.security import digest, new_token, now
from ..mail.templates import send_transfer_outcome, send_transfer_request
from ..models import Company, CompanyTransfer, QrCode, User, Workspace
from ..quotas import Counts, check_capacity, lock_workspace
from ..schemas.company import TransferCreate, TransferToken
from ..storage.usage import company_storage, move_company_files

router = APIRouter(tags=["transfers"])
VALID_DAYS = 7


def transfer_out(session: Session, t: CompanyTransfer) -> dict:
    company = session.get(Company, t.company_id)
    sender = session.get(User, session.get(Workspace, t.from_workspace_id).owner_user_id)
    return {
        "id": t.id,
        "company": {"id": company.id, "name": company.name},
        "from": {"name": sender.display_name, "email": sender.email},
        "to_email": t.to_email,
        "status": effective_status(t),
        "failure_reason": t.failure_reason,
        "created_at": t.created_at,
        "expires_at": t.expires_at,
        "decided_at": t.decided_at,
    }


def effective_status(t: CompanyTransfer) -> str:
    return "expired" if t.status == "pending" and t.expires_at <= now() else t.status


def owner(session: Session, workspace_id: int) -> User:
    return session.get(User, session.get(Workspace, workspace_id).owner_user_id)


@router.post("/api/companies/{company_id}/transfer", status_code=201)
def create_transfer(
    payload: TransferCreate,
    tasks: BackgroundTasks,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    if not rate_limit(session, "transfer-create", str(ctx.workspace.id), 10, 3600):
        raise HTTPException(429, "Troppe richieste di trasferimento. Riprova più tardi.")
    recipient = session.scalar(
        select(User).where(
            User.email == payload.email,
            User.role == "company_admin",
            User.is_active.is_(True),
            User.email_verified_at.is_not(None),
            User.deleted_at.is_(None),
        )
    )
    target = (
        session.scalar(select(Workspace).where(Workspace.owner_user_id == recipient.id))
        if recipient
        else None
    )
    if target is None:
        raise HTTPException(404, "Nessun account Vorya QR verificato con questa email.")
    if target.id == ctx.workspace.id:
        raise HTTPException(422, "L'azienda è già nel tuo account.")
    session.get(Company, ctx.company.id, with_for_update=True)
    pending = session.scalar(
        select(CompanyTransfer).where(
            CompanyTransfer.company_id == ctx.company.id, CompanyTransfer.status == "pending"
        )
    )
    if pending and effective_status(pending) == "pending":
        raise HTTPException(409, "Esiste già una richiesta di trasferimento in attesa.")
    if pending:
        pending.status = "expired"
        session.flush()
    token = new_token()
    transfer = CompanyTransfer(
        company_id=ctx.company.id,
        from_workspace_id=ctx.workspace.id,
        to_workspace_id=target.id,
        to_email=recipient.email,
        token_hash=digest(token),
        status="pending",
        created_by=ctx.user.id,
        expires_at=now() + timedelta(days=VALID_DAYS),
    )
    session.add(transfer)
    session.flush()
    for ws in (ctx.workspace.id, target.id):
        audit(session, ctx.user, "transfer.requested", ws, ctx.company.id, transfer_id=transfer.id)
    session.commit()
    tasks.add_task(send_transfer_request, recipient.email, recipient.display_name,
                   ctx.company.name, ctx.user.display_name, token)  # fmt: skip
    return transfer_out(session, transfer)


@router.get("/api/company-transfers")
def list_transfers(
    ctx: ClientContext = Depends(client_context), session: Session = Depends(get_session)
):
    rows = list(
        session.scalars(
            select(CompanyTransfer)
            .where(
                or_(
                    CompanyTransfer.to_workspace_id == ctx.workspace.id,
                    CompanyTransfer.from_workspace_id == ctx.workspace.id,
                )
            )
            .order_by(CompanyTransfer.created_at.desc())
            .limit(100)
        )
    )
    return {
        "incoming": [
            transfer_out(session, t) for t in rows if t.to_workspace_id == ctx.workspace.id
        ],
        "outgoing": [
            transfer_out(session, t) for t in rows if t.from_workspace_id == ctx.workspace.id
        ],
    }


def _pending_for(session: Session, transfer_id: int, field, workspace_id: int) -> CompanyTransfer:
    t = session.scalar(
        select(CompanyTransfer)
        .where(CompanyTransfer.id == transfer_id, field == workspace_id)
        .with_for_update()
    )
    if t is None:
        raise HTTPException(404, "Richiesta di trasferimento non trovata.")
    if effective_status(t) != "pending":
        if t.status == "pending":
            t.status = "expired"
            session.commit()
        raise HTTPException(409, "La richiesta non è più in attesa.")
    return t


def accept(session: Session, t: CompanyTransfer, ctx: ClientContext, tasks: BackgroundTasks):
    first, second = sorted((t.from_workspace_id, t.to_workspace_id))
    locked = {first: lock_workspace(session, first), second: lock_workspace(session, second)}
    target = locked[t.to_workspace_id]
    if workspace_access(target) in BLOCKED_STATES:
        raise HTTPException(423, "Il tuo account non può ricevere aziende in questo momento.")
    company = session.get(Company, t.company_id, with_for_update=True)
    if company is None or company.deleted_at or company.workspace_id != t.from_workspace_id:
        t.status, t.decided_at = "cancelled", now()
        session.commit()
        raise HTTPException(409, "L'azienda non è più disponibile per il trasferimento.")
    add = Counts(companies=1, storage_bytes=company_storage(session, company.id))
    for kind, count in session.execute(
        select(QrCode.kind, func.count())
        .where(QrCode.company_id == company.id, QrCode.deleted_at.is_(None))
        .group_by(QrCode.kind)
    ):
        setattr(add, kind, count)
    problem = check_capacity(session, target, add)
    if problem:
        t.failure_reason = problem
        session.commit()
        raise CodedError(409, problem, "transfer_capacity")
    company.workspace_id = target.id
    session.execute(
        update(QrCode).where(QrCode.company_id == company.id).values(workspace_id=target.id)
    )
    move_company_files(session, company.id, target.id)
    session.execute(
        update(User).where(User.last_company_id == company.id).values(last_company_id=None)
    )
    t.status, t.decided_at, t.failure_reason = "accepted", now(), None
    for ws in (t.from_workspace_id, t.to_workspace_id):
        audit(session, ctx.user, "transfer.accepted", ws, company.id, transfer_id=t.id)
    session.commit()
    sender, recipient = owner(session, t.from_workspace_id), ctx.user
    tasks.add_task(send_transfer_outcome, sender.email, sender.display_name, company.name,
                   "accepted_sender")  # fmt: skip
    tasks.add_task(send_transfer_outcome, recipient.email, recipient.display_name, company.name,
                   "accepted_recipient")  # fmt: skip
    return transfer_out(session, t)


@router.post("/api/company-transfers/{transfer_id}/accept")
def accept_transfer(
    transfer_id: int,
    tasks: BackgroundTasks,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    t = _pending_for(session, transfer_id, CompanyTransfer.to_workspace_id, ctx.workspace.id)
    return accept(session, t, ctx, tasks)


@router.post("/api/company-transfers/by-token")
def transfer_by_token(
    payload: TransferToken,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    """Resolves the emailed link to the transfer of the logged-in recipient (no action)."""
    t = session.scalar(
        select(CompanyTransfer).where(
            CompanyTransfer.token_hash == digest(payload.token),
            CompanyTransfer.to_workspace_id == ctx.workspace.id,
        )
    )
    if t is None:
        raise HTTPException(404, "Link non valido o destinato a un altro account.")
    return transfer_out(session, t)


@router.post("/api/company-transfers/{transfer_id}/decline")
def decline_transfer(
    transfer_id: int,
    tasks: BackgroundTasks,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    t = _pending_for(session, transfer_id, CompanyTransfer.to_workspace_id, ctx.workspace.id)
    t.status, t.decided_at = "declined", now()
    for ws in (t.from_workspace_id, t.to_workspace_id):
        audit(session, ctx.user, "transfer.declined", ws, t.company_id, transfer_id=t.id)
    session.commit()
    sender = owner(session, t.from_workspace_id)
    company = session.get(Company, t.company_id)
    tasks.add_task(
        send_transfer_outcome, sender.email, sender.display_name, company.name, "declined"
    )
    return transfer_out(session, t)


@router.post("/api/company-transfers/{transfer_id}/cancel")
def cancel_transfer(
    transfer_id: int,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    t = _pending_for(session, transfer_id, CompanyTransfer.from_workspace_id, ctx.workspace.id)
    t.status, t.decided_at = "cancelled", now()
    for ws in (t.from_workspace_id, t.to_workspace_id):
        audit(session, ctx.user, "transfer.cancelled", ws, t.company_id, transfer_id=t.id)
    session.commit()
    return transfer_out(session, t)
