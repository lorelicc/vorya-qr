from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from .auth.deps import ClientContext, client_context
from .core.config import get_settings
from .core.database import get_session
from .plans import TYPE_LABELS, effective_types, features_of, plan_of
from .quotas import usage

router = APIRouter(prefix="/api/account", tags=["account"])


class MailPrefs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    onboarding: bool


@router.get("/mail-preferences")
def read_mail_preferences(ctx: ClientContext = Depends(client_context)):
    return {"onboarding": (ctx.user.mail_prefs or {}).get("onboarding", True)}


@router.put("/mail-preferences")
def save_mail_preferences(
    payload: MailPrefs,
    ctx: ClientContext = Depends(client_context),
    session: Session = Depends(get_session),
):
    ctx.user.mail_prefs = {**(ctx.user.mail_prefs or {}), "onboarding": payload.onboarding}
    session.commit()
    return {"onboarding": payload.onboarding}


@router.get("/plan")
def account_plan(
    ctx: ClientContext = Depends(client_context), session: Session = Depends(get_session)
):
    plan = plan_of(session, ctx.workspace)
    return {
        "plan": {"id": plan.id, "name": plan.name, "description": plan.description},
        "features": {
            **features_of(plan).model_dump(),
            "allowed_types": effective_types(features_of(plan)),
        },
        "type_labels": TYPE_LABELS,
        "access": ctx.access,
        "trial_ends_at": ctx.workspace.trial_ends_at,
        "usage": usage(session, ctx.workspace),
        "support_email": get_settings().support_email,
    }
