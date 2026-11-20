"""Commercial offer shown on the public site, editable from the admin (no code change).

Stored in platform_settings: key "site_offer" (featured plan and label, yearly discount, promo
strip) and, for the trial, the existing keys "trial_days" / "trial_plan_id" of key "general"
(the same ones the registration reads). Texts may use {plan} and {days}: they are filled in with
the REAL trial settings, so the strip can never promise something the sign-up does not give.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth.deps import Auth, admin_reader, admin_writer
from .auth.onboarding import trial_settings
from .auth.service import audit
from .core.database import get_session
from .models import Plan, PlatformSetting

KEY = "site_offer"
public = APIRouter(prefix="/api/public/site", tags=["site"])
admin = APIRouter(prefix="/api/admin/site-offer", tags=["admin-site"])


class Banner(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = True
    text: str = Field(
        default="Prova subito {plan} per {days} giorni, gratis e senza carta", max_length=160
    )
    cta: str = Field(default="Inizia ora", max_length=40)
    href: str = Field(default="/register", max_length=200)
    tone: Literal["green", "indigo", "sun", "coral"] = "green"

    @field_validator("href")
    @classmethod
    def internal_or_https(cls, value: str) -> str:
        value = value.strip()
        if not (value.startswith("/") and not value.startswith("//")) and not value.startswith(
            "https://"
        ):
            raise ValueError("Usa un percorso del sito (/register) o un indirizzo https://.")
        return value


class OfferIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    featured_plan: str | None = Field(default="plus", max_length=40)
    featured_label: str = Field(default="Il più scelto", max_length=30)
    yearly_discount_pct: int = Field(default=20, ge=0, le=90)
    yearly_label: str = Field(default="", max_length=60)
    banner: Banner = Banner()
    trial_days: int = Field(default=14, ge=0, le=90)
    trial_plan_id: str = Field(default="pro", max_length=40)


def read(session: Session) -> OfferIn:
    row = session.get(PlatformSetting, KEY)
    base = OfferIn.model_validate(row.data) if row and row.data else OfferIn()
    days, plan = trial_settings(session)
    return base.model_copy(update={"trial_days": days, "trial_plan_id": plan})


def fill(text: str, plan_name: str, days: int) -> str:
    return text.replace("{plan}", plan_name).replace("{days}", str(days))


@public.get("/offer")
def public_offer(session: Session = Depends(get_session)):
    offer = read(session)
    trial_plan = session.get(Plan, offer.trial_plan_id)
    plan_name = trial_plan.name if trial_plan else offer.trial_plan_id
    featured = offer.featured_plan if session.get(Plan, offer.featured_plan or "") else None
    pct = offer.yearly_discount_pct
    return {
        "featured_plan": featured,
        "featured_label": offer.featured_label,
        "yearly_discount_pct": pct,
        "yearly_label": offer.yearly_label or (f"Risparmi il {pct}%" if pct else ""),
        "trial": {"days": offer.trial_days, "plan_id": offer.trial_plan_id, "plan_name": plan_name},
        "banner": {
            **offer.banner.model_dump(),
            "enabled": offer.banner.enabled
            and offer.trial_days > 0
            or (offer.banner.enabled and "{days}" not in offer.banner.text),
            "text": fill(offer.banner.text, plan_name, offer.trial_days),
        },
    }


@admin.get("")
def admin_read(_: Auth = Depends(admin_reader), session: Session = Depends(get_session)):
    plans = session.scalars(select(Plan).order_by(Plan.position, Plan.id))
    return {
        "offer": read(session).model_dump(),
        "plans": [{"id": p.id, "name": p.name} for p in plans],
    }


@admin.put("")
def admin_save(
    payload: OfferIn,
    auth: Auth = Depends(admin_writer),
    session: Session = Depends(get_session),
):
    for plan_id in {payload.trial_plan_id, payload.featured_plan} - {None}:
        if session.get(Plan, plan_id) is None:
            raise HTTPException(422, f"Piano «{plan_id}» inesistente.")
    data = payload.model_dump(exclude={"trial_days", "trial_plan_id"})
    row = session.get(PlatformSetting, KEY)
    if row is None:
        session.add(PlatformSetting(key=KEY, data=data))
    else:
        row.data = data
    general = session.get(PlatformSetting, "general")
    values = {"trial_days": payload.trial_days, "trial_plan_id": payload.trial_plan_id}
    if general is None:
        session.add(PlatformSetting(key="general", data=values))
    else:
        general.data = {**(general.data or {}), **values}
    audit(session, auth.user, "admin.site_offer", None)
    session.commit()
    return admin_read(auth, session)
