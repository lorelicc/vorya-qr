"""Bulk creation from CSV: template, upload + preview, confirm, progress and result ZIP."""

from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, rate_limit
from ..core.database import get_session
from ..core.errors import CodedError
from ..models import ImportJob
from ..storage.backends import get_storage
from .service import confirm, job_out, preview, template_csv

router = APIRouter(prefix="/api/companies/{company_id}/imports", tags=["imports"])


def _job(session: Session, ctx: CompanyContext, job_id: int, lock=False) -> ImportJob:
    job = session.get(ImportJob, job_id, with_for_update=lock)
    if job is None or job.company_id != ctx.company.id:
        raise HTTPException(404, "Importazione non trovata.")
    return job


@router.get("/template.csv")
def template(ctx: CompanyContext = Depends(owned_company)):
    return Response(
        template_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="vorya-qr-modello.csv"'},
    )


@router.post("", status_code=201)
async def upload(
    file: UploadFile = File(...),
    format: Literal["png", "svg", "pdf", "none"] = Form("png"),  # noqa: A002
    size: int = Form(1024, ge=256, le=4096),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    if not rate_limit(session, "import-upload", str(ctx.workspace.id), 30, 3600):
        session.commit()
        raise CodedError(429, "Troppi caricamenti: riprova tra un po'.", "rate_limited")
    raw = await file.read(2 * 1024 * 1024 + 1)
    job = preview(session, ctx, raw, format, size)
    session.commit()
    return job_out(job)


@router.get("/{job_id}")
def get_job(job_id: int, ctx: CompanyContext = Depends(owned_company),
            session: Session = Depends(get_session)):  # fmt: skip
    return job_out(_job(session, ctx, job_id))


@router.post("/{job_id}/confirm")
def confirm_job(job_id: int, ctx: CompanyContext = Depends(owned_company),
                session: Session = Depends(get_session)):  # fmt: skip
    job = _job(session, ctx, job_id, lock=True)
    confirm(session, ctx, job)
    audit(session, ctx.user, "import.confirmed", ctx.workspace.id, ctx.company.id,
          job_id=job.id, rows=job.total)  # fmt: skip
    session.commit()
    return job_out(job)


@router.post("/{job_id}/retry")
def retry(job_id: int, ctx: CompanyContext = Depends(owned_company),
          session: Session = Depends(get_session)):  # fmt: skip
    job = _job(session, ctx, job_id, lock=True)
    if job.status != "failed":
        raise CodedError(409, "Solo un'importazione non riuscita si può rilanciare.", "not_failed")
    job.status, job.processed, job.error = "queued", 0, None
    session.commit()
    return job_out(job)


@router.get("/{job_id}/result.zip")
def result(job_id: int, ctx: CompanyContext = Depends(owned_company),
           session: Session = Depends(get_session)):  # fmt: skip
    job = _job(session, ctx, job_id)
    if job.status != "done" or not job.result_key:
        raise HTTPException(404, "Il file non è disponibile.")
    data = b"".join(get_storage().read(job.result_key))
    return Response(
        data, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="vorya-qr-import-{job.id}.zip"',
                 "Cache-Control": "no-store"},
    )  # fmt: skip
