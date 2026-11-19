"""Folders, tags, bulk actions, ZIP download and global search."""

import io
import re
import zipfile
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..auth.deps import ClientContext, CompanyContext, client_context, owned_company
from ..auth.service import audit
from ..core.database import get_session
from ..core.errors import CodedError
from ..models import Company, Folder, LinkAlias, LinkTag, QrCode, Tag
from ..qr.service import encoded_content_of

router = APIRouter(prefix="/api/companies/{company_id}", tags=["organization"])
search_router = APIRouter(prefix="/api/search", tags=["organization"])
MAX_DEPTH = 2  # a folder and its sub-folders
COLOR = r"^#[0-9a-fA-F]{6}$"


# ---------------------------------------------------------------- folders


class FolderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    parent_id: int | None = None

    @field_validator("name")
    @classmethod
    def clean(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Inserisci un nome")
        return value


class FolderMove(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=80)
    parent_id: int | None = None
    move: bool = False  # true: apply parent_id (None = to the root)
    position: int | None = Field(default=None, ge=0, le=100_000)


def folder_out(f: Folder, counts: dict[int, int]) -> dict:
    return {"id": f.id, "name": f.name, "parent_id": f.parent_id, "position": f.position,
            "link_count": counts.get(f.id, 0)}  # fmt: skip


def _folder(session: Session, ctx: CompanyContext, folder_id: int) -> Folder:
    folder = session.get(Folder, folder_id)
    if folder is None or folder.company_id != ctx.company.id:
        raise HTTPException(404, "Cartella non trovata.")
    return folder


def _check_parent(
    session: Session, ctx: CompanyContext, parent_id: int | None, moving=None
) -> None:
    if parent_id is None:
        return
    parent = _folder(session, ctx, parent_id)
    if parent.parent_id is not None:
        raise CodedError(409, "Le cartelle si annidano al massimo su 2 livelli.", "max_depth")
    if moving is not None:
        if parent.id == moving.id:
            raise CodedError(409, "Una cartella non può stare dentro sé stessa.", "cycle")
        has_children = session.scalar(select(func.count()).where(Folder.parent_id == moving.id))
        if has_children:  # moving a folder that has sub-folders under another would be level 3
            raise CodedError(409, "Le cartelle si annidano al massimo su 2 livelli.", "max_depth")


@router.get("/folders")
def list_folders(ctx: CompanyContext = Depends(owned_company),
                 session: Session = Depends(get_session)):  # fmt: skip
    folders = session.scalars(
        select(Folder)
        .where(Folder.company_id == ctx.company.id)
        .order_by(Folder.position, Folder.name)
    ).all()
    counts = dict(
        session.execute(
            select(QrCode.folder_id, func.count())
            .where(QrCode.company_id == ctx.company.id, QrCode.deleted_at.is_(None),
                   QrCode.folder_id.is_not(None))
            .group_by(QrCode.folder_id)
        ).all()
    )  # fmt: skip
    unfiled = session.scalar(
        select(func.count()).where(QrCode.company_id == ctx.company.id,
                                   QrCode.deleted_at.is_(None), QrCode.folder_id.is_(None))
    )  # fmt: skip
    return {"folders": [folder_out(f, counts) for f in folders], "unfiled": unfiled}


@router.post("/folders", status_code=201)
def create_folder(body: FolderIn, ctx: CompanyContext = Depends(owned_company),
                  session: Session = Depends(get_session)):  # fmt: skip
    _check_parent(session, ctx, body.parent_id)
    total = session.scalar(select(func.count()).where(Folder.company_id == ctx.company.id))
    if total >= 200:
        raise CodedError(409, "Massimo 200 cartelle per azienda.", "quota_folders")
    position = session.scalar(
        select(func.coalesce(func.max(Folder.position), -1) + 1).where(
            Folder.company_id == ctx.company.id, Folder.parent_id.is_(body.parent_id)
            if body.parent_id is None else Folder.parent_id == body.parent_id,
        )
    )  # fmt: skip
    folder = Folder(company_id=ctx.company.id, parent_id=body.parent_id, name=body.name,
                    position=position)  # fmt: skip
    session.add(folder)
    session.commit()
    return folder_out(folder, {})


@router.put("/folders/{folder_id}")
def update_folder(folder_id: int, body: FolderMove, ctx: CompanyContext = Depends(owned_company),
                  session: Session = Depends(get_session)):  # fmt: skip
    folder = _folder(session, ctx, folder_id)
    if body.name:
        folder.name = " ".join(body.name.split())
    if body.move:
        _check_parent(session, ctx, body.parent_id, moving=folder)
        folder.parent_id = body.parent_id
    if body.position is not None:
        folder.position = body.position
    session.commit()
    counts = {}
    return folder_out(folder, counts)


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: int, ctx: CompanyContext = Depends(owned_company),
                  session: Session = Depends(get_session)):  # fmt: skip
    """Never deletes links: they and the sub-folders move up one level."""
    folder = _folder(session, ctx, folder_id)
    session.query(QrCode).filter(QrCode.folder_id == folder.id).update(
        {"folder_id": folder.parent_id}
    )
    session.query(Folder).filter(Folder.parent_id == folder.id).update(
        {"parent_id": folder.parent_id}
    )
    session.delete(folder)
    session.commit()


# ---------------------------------------------------------------- tags


class TagIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=40)
    color: str = Field(default="#087f5b", pattern=COLOR)

    @field_validator("name")
    @classmethod
    def clean(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Inserisci un nome")
        return value

    @field_validator("color")
    @classmethod
    def lower(cls, value: str) -> str:
        return value.lower()


def tag_out(t: Tag, counts: dict[int, int] | None = None) -> dict:
    return {"id": t.id, "name": t.name, "color": t.color, "link_count": (counts or {}).get(t.id, 0)}


@router.get("/tags")
def list_tags(ctx: CompanyContext = Depends(owned_company),
              session: Session = Depends(get_session)):  # fmt: skip
    tags = session.scalars(
        select(Tag).where(Tag.company_id == ctx.company.id).order_by(Tag.name)
    ).all()
    counts = dict(
        session.execute(
            select(LinkTag.tag_id, func.count())
            .join(QrCode, QrCode.id == LinkTag.qr_code_id)
            .where(QrCode.company_id == ctx.company.id, QrCode.deleted_at.is_(None))
            .group_by(LinkTag.tag_id)
        ).all()
    )
    return [tag_out(t, counts) for t in tags]


def _unique_tag(session: Session, ctx, name: str, ignore: int | None = None) -> None:
    clash = session.scalar(
        select(Tag.id).where(Tag.company_id == ctx.company.id, func.lower(Tag.name) == name.lower())
    )
    if clash and clash != ignore:
        raise CodedError(409, "Esiste già un tag con questo nome.", "duplicate")


@router.post("/tags", status_code=201)
def create_tag(body: TagIn, ctx: CompanyContext = Depends(owned_company),
               session: Session = Depends(get_session)):  # fmt: skip
    if session.scalar(select(func.count()).where(Tag.company_id == ctx.company.id)) >= 200:
        raise CodedError(409, "Massimo 200 tag per azienda.", "quota_tags")
    _unique_tag(session, ctx, body.name)
    tag = Tag(company_id=ctx.company.id, name=body.name, color=body.color)
    session.add(tag)
    session.commit()
    return tag_out(tag)


@router.put("/tags/{tag_id}")
def update_tag(tag_id: int, body: TagIn, ctx: CompanyContext = Depends(owned_company),
               session: Session = Depends(get_session)):  # fmt: skip
    tag = session.get(Tag, tag_id)
    if tag is None or tag.company_id != ctx.company.id:
        raise HTTPException(404, "Tag non trovato.")
    _unique_tag(session, ctx, body.name, ignore=tag.id)
    tag.name, tag.color = body.name, body.color
    session.commit()
    return tag_out(tag)


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag(tag_id: int, ctx: CompanyContext = Depends(owned_company),
               session: Session = Depends(get_session)):  # fmt: skip
    tag = session.get(Tag, tag_id)
    if tag is None or tag.company_id != ctx.company.id:
        raise HTTPException(404, "Tag non trovato.")
    session.delete(tag)
    session.commit()


# ---------------------------------------------------------------- single-link organization


class SetTags(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tag_ids: list[int] = Field(max_length=20)


class SetFolder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    folder_id: int | None = None


def _own_tags(session: Session, ctx, ids: list[int]) -> list[int]:
    found = set(
        session.scalars(select(Tag.id).where(Tag.id.in_(ids), Tag.company_id == ctx.company.id))
    )
    if found != set(ids):
        raise HTTPException(404, "Tag non trovato.")
    return list(found)


def _own_links(session: Session, ctx, ids: list[int]) -> list[QrCode]:
    links = session.scalars(
        select(QrCode).where(QrCode.id.in_(ids), QrCode.company_id == ctx.company.id,
                             QrCode.deleted_at.is_(None)).with_for_update()
    ).all()  # fmt: skip
    if len(links) != len(set(ids)):
        raise HTTPException(404, "Uno o più elementi non sono stati trovati.")
    return links


@router.put("/qr-codes/{qr_id}/tags")
def set_tags(qr_id: int, body: SetTags, ctx: CompanyContext = Depends(owned_company),
             session: Session = Depends(get_session)):  # fmt: skip
    _own_links(session, ctx, [qr_id])
    ids = _own_tags(session, ctx, body.tag_ids)
    session.execute(delete(LinkTag).where(LinkTag.qr_code_id == qr_id))
    if ids:
        session.execute(insert(LinkTag).values([{"qr_code_id": qr_id, "tag_id": t} for t in ids]))
    session.commit()
    return {"tag_ids": sorted(ids)}


@router.put("/qr-codes/{qr_id}/folder")
def set_folder(qr_id: int, body: SetFolder, ctx: CompanyContext = Depends(owned_company),
               session: Session = Depends(get_session)):  # fmt: skip
    (link,) = _own_links(session, ctx, [qr_id])
    if body.folder_id is not None:
        _folder(session, ctx, body.folder_id)
    link.folder_id = body.folder_id
    session.commit()
    return {"folder_id": link.folder_id}


# ---------------------------------------------------------------- bulk


class Bulk(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[int] = Field(min_length=1, max_length=200)
    action: Literal["move", "tag", "untag", "pause", "resume"]
    folder_id: int | None = None
    tag_ids: list[int] = Field(default_factory=list, max_length=20)


@router.post("/qr-codes/bulk")
def bulk(body: Bulk, ctx: CompanyContext = Depends(owned_company),
         session: Session = Depends(get_session)):  # fmt: skip
    """All or nothing: a single transaction, ownership checked for every id first."""
    links = _own_links(session, ctx, body.ids)
    if body.action == "move":
        if body.folder_id is not None:
            _folder(session, ctx, body.folder_id)
        for link in links:
            link.folder_id = body.folder_id
    elif body.action in ("tag", "untag"):
        tags = _own_tags(session, ctx, body.tag_ids)
        if not tags:
            raise HTTPException(422, "Scegli almeno un tag.")
        ids = [link.id for link in links]
        if body.action == "tag":
            rows = [{"qr_code_id": i, "tag_id": t} for i in ids for t in tags]
            session.execute(insert(LinkTag).values(rows).on_conflict_do_nothing())
        else:
            session.execute(
                delete(LinkTag).where(LinkTag.qr_code_id.in_(ids), LinkTag.tag_id.in_(tags))
            )
    else:
        for link in links:
            if link.kind != "dynamic":
                continue  # static QR codes have no status to change
            if link.status == "blocked":
                raise CodedError(
                    403, "Un QR bloccato dal team non si può riattivare.", "qr_blocked"
                )
            link.status = "paused" if body.action == "pause" else "active"
    audit(session, ctx.user, f"link.bulk_{body.action}", ctx.workspace.id, ctx.company.id,
          count=len(links))  # fmt: skip
    session.commit()
    return {"updated": len(links)}


class BulkZip(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[int] = Field(min_length=1, max_length=100)
    format: Literal["png", "svg", "pdf"] = "png"
    size: int = Field(default=1024, ge=128, le=4096)


def safe_name(value: str) -> str:
    stem = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:60]
    return stem or "qr"


@router.post("/qr-codes/bulk-zip")
def bulk_zip(body: BulkZip, ctx: CompanyContext = Depends(owned_company),
             session: Session = Depends(get_session)):  # fmt: skip
    from ..qr.design_service import design_of, render
    from ..qr.designer import svg_to_pdf, svg_to_png

    links = [link for link in _own_links(session, ctx, body.ids) if link.has_qr]
    if not links:
        raise CodedError(422, "Nessuno degli elementi scelti ha un QR da scaricare.", "no_qr")
    buffer = io.BytesIO()
    used: set[str] = set()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for link in links:
            svg = render(session, ctx.company.id, encoded_content_of(link), design_of(link))
            data = {"svg": lambda s=svg: s.encode(), "png": lambda s=svg: svg_to_png(s, body.size),
                    "pdf": lambda s=svg: svg_to_pdf(s)}[body.format]()  # fmt: skip
            name = f"{safe_name(link.name)}.{body.format}"
            if name in used:
                name = f"{safe_name(link.name)}-{link.id}.{body.format}"
            used.add(name)
            archive.writestr(name, data)
    return Response(
        buffer.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="vorya-qr.zip"',
                 "Cache-Control": "no-store"},
    )  # fmt: skip


# ---------------------------------------------------------------- global search


@search_router.get("")
def search(
    q: str = Query(min_length=1, max_length=120),
    company_id: int | None = None,
    all_companies: bool = False,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    """Name, slug, alias, destination URL and tag name; current company or all of the account."""
    term = f"%{q.strip().replace('%', '').replace('_', '')}%"
    companies = select(Company.id).where(Company.workspace_id == ctx.workspace.id,
                                         Company.deleted_at.is_(None))  # fmt: skip
    if not all_companies:
        if company_id is None:
            raise HTTPException(422, "Indica l'azienda.")
        companies = companies.where(Company.id == company_id)
    tagged = (
        select(LinkTag.qr_code_id).join(Tag, Tag.id == LinkTag.tag_id).where(Tag.name.ilike(term))
    )
    aliased = select(LinkAlias.qr_code_id).where(LinkAlias.alias.ilike(term),
                                                 LinkAlias.removed_at.is_(None))  # fmt: skip
    rows = session.execute(
        select(QrCode, Company.name)
        .join(Company, Company.id == QrCode.company_id)
        .where(
            QrCode.company_id.in_(companies),
            QrCode.deleted_at.is_(None),
            or_(QrCode.name.ilike(term), QrCode.slug.ilike(term), QrCode.target_url.ilike(term),
                QrCode.id.in_(tagged), QrCode.id.in_(aliased)),
        )
        .order_by(QrCode.created_at.desc())
        .limit(25)
    ).all()  # fmt: skip
    return [
        {"id": qr.id, "company_id": qr.company_id, "company": company, "name": qr.name,
         "slug": qr.slug, "qr_type": qr.qr_type, "kind": qr.kind, "status": qr.status,
         "has_qr": qr.has_qr, "target_url": qr.target_url}
        for qr, company in rows
    ]  # fmt: skip
