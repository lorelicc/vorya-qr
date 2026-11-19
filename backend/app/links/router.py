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
from ..models import LinkAlias, Plan, UtmTemplate
from ..plans import features_of, locked
from ..qr.render import root_link
from ..qr.service import get_owned, insert_qr, qr_out
from ..quotas import reserve_slot
from ..schemas.qr import LinkQuickCreate, QrCreate, QrOut
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
