"""0.3 short links: quick creation from a pasted URL (no QR until "Genera QR")."""

from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, client_ip, rate_limit
from ..core.config import get_settings
from ..core.database import get_session
from ..core.errors import CodedError
from ..core.security import now
from ..models import LinkAlias, LinkVersion, Plan, StoredFile, UtmTemplate
from ..plans import features_of, locked
from ..qr.render import root_link
from ..qr.service import get_owned, insert_qr, qr_out
from ..quotas import reserve_slot
from ..schemas.qr import LinkQuickCreate, QrCreate, QrOut, QrUpdate
from .service import (
    UNLOCK_SECONDS,
    LinkRules,
    add_alias,
    alias_problem,
    apply_rules,
    check_password,
    cookie_name,
    field_error,
    normalise_alias,
    rules_out,
    unlock_token,
)  # fmt: skip
from .versions import KEEP, authors_of, require_history, version_out

router = APIRouter(prefix="/api/companies/{company_id}/links", tags=["links"])


@router.post("", response_model=QrOut, status_code=201)
def quick_create(
    payload: LinkQuickCreate,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    if not rate_limit(session, "qr-create", str(ctx.workspace.id), 120, 3600):
        raise HTTPException(429, "Troppi link creati in poco tempo. Riprova più tardi.")
    url = payload.target_url.strip()
    name = " ".join(payload.name.split()) or (urlsplit(url).hostname or "Link")[:120]
    reserve_slot(session, ctx.workspace.id, "dynamic")  # links and dynamic QR share the quota
    body = QrCreate(name=name, qr_type="website", dynamic=True, has_qr=False, target_url=url)
    link = insert_qr(session, ctx, body)
    audit(session, ctx.user, "link.created", ctx.workspace.id, ctx.company.id, qr_id=link.id)
    session.commit()
    return qr_out(link)


# ---------------------------------------------------------------- aliases and rules

links_qr = APIRouter(prefix="/api/companies/{company_id}/qr-codes", tags=["links"])


class AliasIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    alias: str = Field(min_length=1, max_length=60)


def alias_out(row: LinkAlias) -> dict:
    return {"id": row.id, "alias": row.alias, "url": root_link(row.alias),
            "created_at": row.created_at}  # fmt: skip


@links_qr.get("/aliases/check")
def check_alias(
    alias: str = Query(max_length=60),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    value = normalise_alias(alias)
    problem = alias_problem(session, value, ctx.workspace.id)
    return {"alias": value, "available": problem is None, "reason": problem}


@links_qr.get("/{qr_id}/aliases")
def list_aliases(
    qr_id: int, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    link = get_owned(session, ctx, qr_id)
    rows = session.scalars(
        select(LinkAlias)
        .where(LinkAlias.qr_code_id == link.id, LinkAlias.removed_at.is_(None))
        .order_by(LinkAlias.created_at)
    )
    return [alias_out(r) for r in rows]


@links_qr.post("/{qr_id}/aliases", status_code=201)
def create_alias(
    qr_id: int, body: AliasIn, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    link = get_owned(session, ctx, qr_id, lock=True)
    row = add_alias(session, ctx.workspace, link, body.alias)
    audit(session, ctx.user, "link.alias_added", ctx.workspace.id, ctx.company.id,
          qr_id=link.id, alias=row.alias)  # fmt: skip
    session.commit()
    return alias_out(row)


@links_qr.delete("/{qr_id}/aliases/{alias_id}", status_code=204)
def remove_alias(
    qr_id: int, alias_id: int, confirm: bool = False,
    ctx: CompanyContext = Depends(owned_company), session: Session = Depends(get_session),
):  # fmt: skip
    link = get_owned(session, ctx, qr_id, lock=True)
    row = session.get(LinkAlias, alias_id)
    if row is None or row.qr_code_id != link.id or row.removed_at is not None:
        raise HTTPException(404, "Back-half non trovato.")
    if not confirm:  # printed QR codes or shared links using it will stop working
        raise CodedError(409, "Conferma la rimozione del back-half.", "confirm_required")
    row.removed_at = now()
    audit(session, ctx.user, "link.alias_removed", ctx.workspace.id, ctx.company.id,
          qr_id=link.id, alias=row.alias)  # fmt: skip
    session.commit()


@links_qr.get("/{qr_id}/rules")
def get_rules(
    qr_id: int, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    return rules_out(get_owned(session, ctx, qr_id))


@links_qr.put("/{qr_id}/rules")
def put_rules(
    qr_id: int, body: LinkRules, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    link = get_owned(session, ctx, qr_id, lock=True)
    from ..abuse.checks import check_destinations

    check_destinations(session, link.fallback_url, [e.url for e in body.schedule],
                       body.fallback_url)  # fmt: skip
    apply_rules(session, ctx.workspace, link, body)
    audit(session, ctx.user, "link.rules_updated", ctx.workspace.id, ctx.company.id, qr_id=link.id)
    session.commit()
    return rules_out(link)


# ---------------------------------------------------------------- UTM templates

utm = APIRouter(prefix="/api/companies/{company_id}/utm-templates", tags=["links"])
UTM_FIELDS = ("source", "medium", "campaign", "term", "content")


class UtmIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    source: str = Field(default="", max_length=100)
    medium: str = Field(default="", max_length=100)
    campaign: str = Field(default="", max_length=100)
    term: str = Field(default="", max_length=100)
    content: str = Field(default="", max_length=100)


def utm_out(t: UtmTemplate) -> dict:
    return {"id": t.id, "name": t.name, **{f: getattr(t, f) for f in UTM_FIELDS}}


@utm.get("")
def list_utm(ctx: CompanyContext = Depends(owned_company), session: Session = Depends(get_session)):
    rows = session.scalars(
        select(UtmTemplate)
        .where(UtmTemplate.company_id == ctx.company.id)
        .order_by(UtmTemplate.name)
    )
    return [utm_out(t) for t in rows]


@utm.post("", status_code=201)
def create_utm(body: UtmIn, ctx: CompanyContext = Depends(owned_company),
               session: Session = Depends(get_session)):  # fmt: skip
    if not features_of(session.get(Plan, ctx.workspace.plan_id)).utm_templates:
        raise locked("I modelli UTM")
    count = session.scalar(select(func.count()).where(UtmTemplate.company_id == ctx.company.id))
    if count >= 100:
        raise CodedError(409, "Massimo 100 modelli UTM per azienda.", "quota_utm")
    row = UtmTemplate(company_id=ctx.company.id, **body.model_dump())
    session.add(row)
    session.commit()
    return utm_out(row)


@utm.delete("/{template_id}", status_code=204)
def delete_utm(template_id: int, ctx: CompanyContext = Depends(owned_company),
               session: Session = Depends(get_session)):  # fmt: skip
    row = session.get(UtmTemplate, template_id)
    if row is None or row.company_id != ctx.company.id:
        raise HTTPException(404, "Modello non trovato.")
    session.delete(row)
    session.commit()


# ---------------------------------------------------------------- public: password unlock

public = APIRouter(prefix="/api/public/links", tags=["public"])


class UnlockIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=128)


@public.post("/{slug}/unlock")
def unlock(slug: str, body: UnlockIn, request: Request, response: Response,
           session: Session = Depends(get_session)):  # fmt: skip
    from ..redirect.router import SLUG, resolve

    row = resolve(session, slug) if SLUG.match(slug) else None
    if row is None or not row.password_hash:
        raise HTTPException(404, "Link non trovato.")
    key = f"{client_ip(request)}:{row.id}"
    if not rate_limit(session, "link-unlock", key, 10, 900):
        session.commit()
        raise CodedError(429, "Troppi tentativi. Riprova tra qualche minuto.", "rate_limited")
    session.commit()
    if not check_password(body.password, row.password_hash):
        raise field_error(422, "Password non corretta.", "wrong_password", "password")
    response.set_cookie(
        cookie_name(row.id), unlock_token(session, row.id, row.password_hash),
        max_age=UNLOCK_SECONDS, httponly=True, samesite="lax",
        secure=get_settings().is_production, path="/",
    )  # fmt: skip
    return {"ok": True}


# ---------------------------------------------------------------- versions


@links_qr.get("/{qr_id}/versions")
def list_versions(
    qr_id: int,
    qr_type: str = Query(default="", max_length=16),
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    require_history(session, ctx.workspace)
    link = get_owned(session, ctx, qr_id)
    query = select(LinkVersion).where(LinkVersion.qr_code_id == link.id)
    if qr_type:
        query = query.where(LinkVersion.qr_type == qr_type)
    rows = session.scalars(query.order_by(LinkVersion.number.desc()).limit(KEEP)).all()
    authors = authors_of(session, rows)
    return [version_out(v, authors, detail=bool(qr_type)) for v in rows]


@links_qr.get("/{qr_id}/versions/{number}")
def get_version(
    qr_id: int, number: int, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    require_history(session, ctx.workspace)
    link = get_owned(session, ctx, qr_id)
    version = session.scalar(
        select(LinkVersion).where(LinkVersion.qr_code_id == link.id, LinkVersion.number == number)
    )
    if version is None:
        raise HTTPException(404, "Versione non trovata.")
    wanted = select(StoredFile).where(StoredFile.id.in_(version.file_ids or []))
    files = {}
    for f in session.scalars(wanted):
        if f.deleted_at is None:
            urls = {n: f"/f/{f.id}/{n}" for n in f.variants}
            files[f.id] = {"kind": f.kind, "name": f.original_name, "urls": urls,
                           "pages": f.page_count}  # fmt: skip
    return {**version_out(version, authors_of(session, [version]), detail=True), "files": files}


@links_qr.post("/{qr_id}/versions/{number}/restore")
def restore_version(
    qr_id: int, number: int, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    require_history(session, ctx.workspace)
    link = get_owned(session, ctx, qr_id, lock=True)
    version = session.scalar(
        select(LinkVersion).where(LinkVersion.qr_code_id == link.id, LinkVersion.number == number)
    )
    if version is None:
        raise HTTPException(404, "Versione non trovata.")
    from ..qr.service import apply_content_change, qr_out
    from ..schemas.page import Page

    page = Page.model_validate(version.page) if version.page else None
    content = QrUpdate(name=link.name, qr_type=version.qr_type, target_url=version.target_url,
                       page=page, design=None)  # fmt: skip
    # The design belongs to the QR, not to the content: keep the one in use.
    from ..qr.design_service import design_of

    content.design = design_of(link)
    apply_content_change(session, ctx, link, content, change="restore")
    audit(session, ctx.user, "link.version_restored", ctx.workspace.id, ctx.company.id,
          qr_id=link.id, number=number)  # fmt: skip
    session.commit()
    return qr_out(link)


# ---------------------------------------------------------------- menu quick edit


class ItemPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sold_out: bool | None = None
    price: str | None = None
    price_glass: str | None = None
    price_bottle: str | None = None


@links_qr.patch("/{qr_id}/menu/items/{item_id}")
def patch_menu_item(
    qr_id: int, item_id: str, body: ItemPatch, ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):  # fmt: skip
    """Sold-out toggle and prices from a phone, in one tap: updates the live page and the current
    version in place (no new version, so 20 toggles never push real history out)."""
    from ..models import QrPage
    from ..schemas.page import Page

    link = get_owned(session, ctx, qr_id, lock=True)
    row = session.get(QrPage, link.id)
    if link.qr_type != "menu" or row is None:
        raise HTTPException(404, "Questo QR non è un menu.")
    page = Page.model_validate(row.document)
    item = next(
        (i for b in page.blocks if b.type == "menu" for s in b.sections for i in s.items
         if i.id == item_id),
        None,
    )  # fmt: skip
    if item is None:
        raise HTTPException(404, "Voce non trovata.")
    data = body.model_dump(exclude_unset=True)
    if "sold_out" in data and data["sold_out"] is not None:
        item.sold_out = data["sold_out"]
    if "price" in data:
        item.price = data["price"]
    if item.wine is not None:
        for key in ("price_glass", "price_bottle"):
            if key in data:
                setattr(item.wine, key, data[key])
    try:
        document = Page.model_validate(page.model_dump(mode="json")).model_dump(mode="json")
    except ValueError as exc:
        raise field_error(422, str(exc).split("\n")[-1][:200], "invalid_content", "price") from None
    row.document = document
    latest = session.scalar(
        select(LinkVersion).where(LinkVersion.qr_code_id == link.id)
        .order_by(LinkVersion.number.desc()).limit(1)
    )  # fmt: skip
    if latest is not None:
        latest.page = document
    link.updated_at = now()
    session.commit()
    saved = next(
        i for b in document["blocks"] if b["type"] == "menu"
        for sec in b["sections"] for i in sec["items"] if i["id"] == item_id
    )  # fmt: skip
    return {"id": item_id, "sold_out": saved["sold_out"], "price": saved["price"]}
