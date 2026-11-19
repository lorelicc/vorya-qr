"""Public abuse reports and the admin moderation endpoints."""

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth.deps import Auth, admin_reader, admin_writer
from ..auth.service import audit, client_ip, rate_limit
from ..core.database import get_session
from ..core.errors import CodedError
from ..core.security import now
from ..models import AbuseReport, BlockedDomain, Company, QrCode, Workspace
from .checks import normalise_domain

public = APIRouter(prefix="/api/public/reports", tags=["public"])
admin = APIRouter(prefix="/api/admin", tags=["admin"])
REASONS = Literal["phishing", "malware", "spam", "illegal", "other"]
SLUG_IN = re.compile(r"(?:/r/)?([A-Za-z0-9]{7})/?$")
DOMAIN = re.compile(r"^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


class ReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    link: str = Field(min_length=7, max_length=300, description="Short link or its code")
    reason: REASONS
    details: str = Field(default="", max_length=2000)
    email: EmailStr | None = None
    website: str = Field(default="", max_length=0)  # honeypot: humans leave it empty

    @field_validator("link")
    @classmethod
    def slug_of(cls, value: str) -> str:
        match = SLUG_IN.search(value.strip())
        if not match:
            raise ValueError("Inserisci il link del QR (es. https://qr.vorya.it/r/Ab3dEf7).")
        return match.group(1)


@public.post("", status_code=202)
def create_report(body: ReportIn, request: Request, session: Session = Depends(get_session)):
    if not rate_limit(session, "abuse-report", client_ip(request), 5, 3600):
        session.commit()
        raise CodedError(429, "Hai inviato troppe segnalazioni. Riprova più tardi.", "rate_limited")
    qr_id = session.scalar(select(QrCode.id).where(QrCode.slug == body.link))
    session.add(AbuseReport(slug=body.link, qr_code_id=qr_id, reason=body.reason,
                            details=body.details.strip(), reporter_email=body.email))  # fmt: skip
    session.commit()
    # Same answer whether the code exists or not: the form cannot be used to probe slugs.
    return {"detail": "Grazie: la segnalazione è stata inviata al team Vorya."}


def report_out(report: AbuseReport, qr: QrCode | None, company, workspace) -> dict:
    return {
        "id": report.id, "created_at": report.created_at, "slug": report.slug,
        "reason": report.reason, "details": report.details,
        "reporter_email": report.reporter_email, "status": report.status,
        "resolution": report.resolution, "resolved_at": report.resolved_at,
        "qr": None if qr is None else {
            "id": qr.id, "name": qr.name, "status": qr.status, "qr_type": qr.qr_type,
            "destination": qr.destination, "target_url": qr.target_url,
            "deleted": qr.deleted_at is not None,
        },
        "company": None if company is None else {"id": company.id, "name": company.name},
        "workspace": None if workspace is None else {
            "id": workspace.id, "name": workspace.name, "status": workspace.status,
        },
    }  # fmt: skip


def _rows(session: Session, *where):
    return session.execute(
        select(AbuseReport, QrCode, Company, Workspace)
        .outerjoin(QrCode, QrCode.id == AbuseReport.qr_code_id)
        .outerjoin(Company, Company.id == QrCode.company_id)
        .outerjoin(Workspace, Workspace.id == Company.workspace_id)
        .where(*where)
        .order_by(AbuseReport.created_at.desc())
        .limit(500)
    ).all()


@admin.get("/reports")
def list_reports(
    status: Literal["open", "resolved", "all"] = "open",
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    where = [] if status == "all" else [AbuseReport.status == status]
    open_count = session.scalar(
        select(func.count()).select_from(AbuseReport).where(AbuseReport.status == "open")
    )
    return {"open": open_count, "items": [report_out(*row) for row in _rows(session, *where)]}


class Resolve(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["dismiss", "block_qr", "suspend_workspace"]
    note: str = Field(default="", max_length=200)


@admin.post("/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    body: Resolve,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    report = session.get(AbuseReport, report_id, with_for_update=True)
    if report is None:
        raise HTTPException(404, "Segnalazione non trovata.")
    qr = session.get(QrCode, report.qr_code_id, with_for_update=True) if report.qr_code_id else None
    if body.action != "dismiss" and qr is None:
        raise CodedError(409, "La segnalazione non corrisponde a nessun QR.", "no_qr")
    workspace_id = qr.workspace_id if qr else None
    if body.action == "block_qr":
        qr.status, qr.blocked_reason = "blocked", body.note or f"Segnalazione: {report.reason}"
    elif body.action == "suspend_workspace":
        workspace = session.get(Workspace, qr.workspace_id, with_for_update=True)
        workspace.status, workspace.suspended_at = "suspended", now()
    # One decision closes every open report about the same QR.
    same = select(AbuseReport).where(AbuseReport.status == "open")
    same = same.where(AbuseReport.qr_code_id == qr.id) if qr else same.where(
        AbuseReport.id == report.id)  # fmt: skip
    for item in session.scalars(same.with_for_update()):
        item.status, item.resolution = "resolved", body.action
        item.resolved_by, item.resolved_at = auth.user.id, now()
    audit(session, auth.user, f"admin.report_{body.action}", workspace_id,
          report_id=report.id, qr_id=qr.id if qr else None)  # fmt: skip
    session.commit()
    row = _rows(session, AbuseReport.id == report.id)[0]
    return report_out(*row)


@admin.post("/qr-codes/{qr_id}/unblock")
def unblock_qr(qr_id: int, auth: Auth = Depends(admin_writer),
               session: Session = Depends(get_session)):  # fmt: skip
    qr = session.get(QrCode, qr_id, with_for_update=True)
    if qr is None or qr.status != "blocked":
        raise HTTPException(404, "QR bloccato non trovato.")
    qr.status, qr.blocked_reason = "active", None
    audit(session, auth.user, "admin.qr_unblocked", qr.workspace_id, qr_id=qr.id)
    session.commit()
    return {"id": qr.id, "status": qr.status}


class DomainIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str = Field(min_length=3, max_length=300)
    reason: str = Field(default="", max_length=200)

    @field_validator("domain")
    @classmethod
    def valid(cls, value: str) -> str:
        value = normalise_domain(value)
        if not DOMAIN.match(value):
            raise ValueError("Dominio non valido (es. esempio.com).")
        return value


def domain_out(d: BlockedDomain) -> dict:
    return {"id": d.id, "domain": d.domain, "reason": d.reason, "created_at": d.created_at}


@admin.get("/blocked-domains")
def list_domains(
    search: str = Query(default="", max_length=120),
    _: Auth = Depends(admin_reader),
    session: Session = Depends(get_session),
):
    query = select(BlockedDomain).order_by(BlockedDomain.domain)
    if search.strip():
        query = query.where(BlockedDomain.domain.ilike(f"%{search.strip().lower()}%"))
    return [domain_out(d) for d in session.scalars(query.limit(1000))]


@admin.post("/blocked-domains", status_code=201)
def add_domain(body: DomainIn, auth: Auth = Depends(admin_writer),
               session: Session = Depends(get_session)):  # fmt: skip
    domain = BlockedDomain(domain=body.domain, reason=body.reason, created_by=auth.user.id)
    session.add(domain)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise CodedError(409, "Dominio già bloccato.", "duplicate") from None
    audit(session, auth.user, "admin.domain_blocked", None, domain=body.domain)
    session.commit()
    return domain_out(domain)


@admin.delete("/blocked-domains/{domain_id}", status_code=204)
def remove_domain(domain_id: int, auth: Auth = Depends(admin_writer),
                  session: Session = Depends(get_session)):  # fmt: skip
    domain = session.get(BlockedDomain, domain_id)
    if domain is None:
        raise HTTPException(404, "Dominio non trovato.")
    audit(session, auth.user, "admin.domain_unblocked", None, domain=domain.domain)
    session.delete(domain)
    session.commit()
