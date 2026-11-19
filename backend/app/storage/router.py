import hashlib
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, rate_limit
from ..core.database import get_session
from ..core.errors import CodedError, QuotaExceeded
from ..models import Company, Plan, StoredFile
from ..plans import features_of
from ..quotas import limits, lock_workspace
from .backends import get_storage
from .process import InvalidFile, process
from .sniff import sniff
from .usage import soft_delete, storage_used

router = APIRouter(prefix="/api/companies/{company_id}", tags=["files"])
PURPOSES = {
    "image": "image", "cover": "image", "avatar": "image", "gallery": "image", "logo": "image",
    "pdf": "pdf", "audio": "audio",
}  # fmt: skip
KIND_LABEL = {
    "image": "un'immagine JPG, PNG o WebP",
    "pdf": "un PDF",
    "audio": "un audio MP3, M4A o WAV",
}
UPLOAD_WINDOW, UPLOADS_PER_WINDOW = 600, 60


def file_out(f: StoredFile) -> dict:
    return {
        "id": f.id,
        "kind": f.kind,
        "purpose": f.purpose,
        "mime": f.mime,
        "original_name": f.original_name,
        "size_bytes": f.size_bytes,
        "page_count": f.page_count,
        "urls": {name: f"/f/{f.id}/{name}" for name in f.variants},
        "created_at": f.created_at,
    }


def _read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    data = upload.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise CodedError(
            413,
            f"Il file supera il limite di {max_bytes // (1024 * 1024)} MB del piano.",
            "file_too_large",
        )
    if not data:
        raise HTTPException(422, "Il file è vuoto.")
    return data


def store_upload(session: Session, ctx: CompanyContext, upload: UploadFile, purpose: str,
                 qr_code_id: int | None = None) -> StoredFile:  # fmt: skip
    if purpose not in PURPOSES:
        raise HTTPException(422, "Tipo di caricamento non valido.")
    if not rate_limit(session, "upload", str(ctx.workspace.id), UPLOADS_PER_WINDOW, UPLOAD_WINDOW):
        raise HTTPException(429, "Troppi caricamenti. Riprova tra qualche minuto.")
    plan = session.get(Plan, ctx.workspace.plan_id)
    data = _read_limited(upload, features_of(plan).max_file_mb * 1024 * 1024)
    sniffed = sniff(data[:64])
    if sniffed is None or sniffed.kind != PURPOSES[purpose]:
        raise CodedError(415, f"Formato non supportato: carica {KIND_LABEL[PURPOSES[purpose]]}. "
                              "Le immagini SVG non sono ammesse.", "unsupported_type")  # fmt: skip
    try:
        processed = process(data, sniffed, purpose)
    except InvalidFile as exc:
        raise CodedError(422, str(exc), "invalid_file") from None
    file_id = str(uuid.uuid4())
    storage = get_storage()
    variants = {}
    for v in processed.variants:  # write bytes first, outside the quota lock
        key = f"files/{file_id}/{v.name}"
        storage.put(key, v.data, v.mime)
        variants[v.name] = {"key": key, "mime": v.mime, "size": len(v.data),
                            "width": v.width, "height": v.height}  # fmt: skip
    total = sum(v["size"] for v in variants.values())
    try:
        workspace = lock_workspace(session, ctx.workspace.id)
        limit = limits(session.get(Plan, workspace.plan_id))["storage_bytes"]
        if limit is not None and storage_used(session, workspace.id) + total > limit:
            raise QuotaExceeded(
                "Spazio di archiviazione esaurito per il piano attuale. Elimina qualche file "
                "o contattaci per passare a un piano superiore.",
                "quota_storage",
            )
        record = StoredFile(
            id=file_id, workspace_id=workspace.id, company_id=ctx.company.id, qr_code_id=qr_code_id,
            kind=sniffed.kind, purpose=purpose, mime=sniffed.mime,
            original_name=(upload.filename or f"file.{sniffed.ext}")[:200],
            size_bytes=total, sha256=hashlib.sha256(data).hexdigest(), variants=variants,
            page_count=processed.meta.get("pages"),
        )  # fmt: skip
        session.add(record)
        audit(session, ctx.user, "file.uploaded", workspace.id, ctx.company.id, file_id=file_id)
        session.flush()
    except Exception:
        session.rollback()
        for v in variants.values():
            storage.delete(v["key"])
        raise
    return record


@router.post("/files", status_code=201)
def upload_file(
    file: UploadFile = File(...),
    purpose: str = Form(...),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    record = store_upload(session, ctx, file, purpose)
    session.commit()
    return file_out(record)


@router.get("/files")
def list_files(
    kind: str = Query(default="", pattern="^(|image|pdf|audio)$"),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    query = select(StoredFile).where(
        StoredFile.company_id == ctx.company.id, StoredFile.deleted_at.is_(None),
        StoredFile.purpose != "logo",
    )  # fmt: skip
    if kind:
        query = query.where(StoredFile.kind == kind)
    files = session.scalars(query.order_by(StoredFile.created_at.desc()).limit(500))
    plan = session.get(Plan, ctx.workspace.plan_id)
    return {
        "files": [file_out(f) for f in files],
        "storage": {
            "used": storage_used(session, ctx.workspace.id),
            "limit": limits(plan)["storage_bytes"],
            "max_file_bytes": features_of(plan).max_file_mb * 1024 * 1024,
        },  # fmt: skip
    }


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: str, ctx: CompanyContext = Depends(owned_company),
                session: Session = Depends(get_session)):  # fmt: skip
    record = session.scalar(
        select(StoredFile).where(
            StoredFile.id == file_id, StoredFile.company_id == ctx.company.id,
            StoredFile.deleted_at.is_(None),
        ).with_for_update()
    )  # fmt: skip
    if record is None:
        raise HTTPException(404, "File non trovato.")
    soft_delete(session, record)
    audit(session, ctx.user, "file.deleted", ctx.workspace.id, ctx.company.id, file_id=file_id)
    session.commit()


@router.post("/logo")
def upload_logo(file: UploadFile = File(...), ctx: CompanyContext = Depends(owned_company),
                session: Session = Depends(get_session)):  # fmt: skip
    record = store_upload(session, ctx, file, "logo")
    company = session.get(Company, ctx.company.id, with_for_update=True)
    previous = session.get(StoredFile, company.logo_file_id) if company.logo_file_id else None
    if previous and previous.deleted_at is None:
        soft_delete(session, previous)
    company.logo_file_id = record.id
    session.commit()
    return {"logo_url": f"/f/{record.id}/logo"}


@router.delete("/logo", status_code=204)
def delete_logo(
    ctx: CompanyContext = Depends(owned_company), session: Session = Depends(get_session)
):
    company = session.get(Company, ctx.company.id, with_for_update=True)
    previous = session.get(StoredFile, company.logo_file_id) if company.logo_file_id else None
    if previous and previous.deleted_at is None:
        soft_delete(session, previous)
    company.logo_file_id = None
    session.commit()
