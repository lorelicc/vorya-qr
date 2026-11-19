from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..auth.deps import ClientContext, CompanyContext, client_context, owned_company
from ..auth.service import audit
from ..core.database import get_session
from ..core.security import now
from ..models import Company, CompanyTransfer, User
from ..quotas import reserve_company
from ..schemas.company import CompanyDelete, CompanyIn, CompanyOut, LastCompany
from .service import RESTORE_DAYS, company_out, company_stats

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("", response_model=list[CompanyOut])
def list_companies(
    deleted: bool = Query(default=False),
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    """Active companies, or (deleted=true) the ones still restorable."""
    query = select(Company).where(
        Company.workspace_id == ctx.workspace.id, Company.status == "active"
    )
    query = (
        query.where(Company.deleted_at.is_not(None), Company.purge_after > now())
        if deleted
        else query.where(Company.deleted_at.is_(None))
    )
    items = list(session.scalars(query.order_by(Company.created_at, Company.id)))
    stats = company_stats(session, [c.id for c in items])
    return [company_out(c, stats[c.id]) for c in items]


@router.post("", response_model=CompanyOut, status_code=201)
def create_company(
    payload: CompanyIn,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    reserve_company(session, ctx.workspace.id)
    company = Company(workspace_id=ctx.workspace.id, **payload.model_dump())
    session.add(company)
    session.flush()
    audit(session, ctx.user, "company.created", ctx.workspace.id, company_id=company.id)
    session.commit()
    return company_out(company)


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    ctx: CompanyContext = Depends(owned_company), session: Session = Depends(get_session)
):
    return company_out(ctx.company, company_stats(session, [ctx.company.id])[ctx.company.id])


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    payload: CompanyIn,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    for field, value in payload.model_dump().items():
        setattr(ctx.company, field, value)
    session.commit()
    return company_out(ctx.company, company_stats(session, [ctx.company.id])[ctx.company.id])


@router.delete("/{company_id}", status_code=204)
def delete_company(
    payload: CompanyDelete,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    company = session.get(Company, ctx.company.id, with_for_update=True)
    if " ".join(payload.confirm_name.split()) != company.name:
        raise HTTPException(422, "Per confermare digita esattamente il nome dell'azienda.")
    company.deleted_at = now()
    company.purge_after = now() + timedelta(days=RESTORE_DAYS)
    session.execute(
        update(CompanyTransfer)
        .where(CompanyTransfer.company_id == company.id, CompanyTransfer.status == "pending")
        .values(status="cancelled", decided_at=now())
    )
    session.execute(
        update(User).where(User.last_company_id == company.id).values(last_company_id=None)
    )
    audit(session, ctx.user, "company.deleted", ctx.workspace.id, company_id=company.id)
    session.commit()


@router.post("/{company_id}/restore", response_model=CompanyOut)
def restore_company(
    company_id: int,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    reserve_company(session, ctx.workspace.id)
    company = session.scalar(
        select(Company)
        .where(
            Company.id == company_id,
            Company.workspace_id == ctx.workspace.id,
            Company.status == "active",
            Company.deleted_at.is_not(None),
            Company.purge_after > now(),
        )
        .with_for_update()
    )
    if company is None:
        raise HTTPException(404, "Azienda non trovata o non più recuperabile.")
    company.deleted_at = company.purge_after = None
    audit(session, ctx.user, "company.restored", ctx.workspace.id, company_id=company.id)
    session.commit()
    return company_out(company, company_stats(session, [company.id])[company.id])


account_router = APIRouter(prefix="/api/account", tags=["account"])


@account_router.put("/last-company", status_code=204)
def set_last_company(
    payload: LastCompany,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    owned_company(payload.company_id, ctx, session)  # same chain check
    user = session.get(User, ctx.user.id)
    user.last_company_id = payload.company_id
    session.commit()
