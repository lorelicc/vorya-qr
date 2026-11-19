from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .auth.deps import ClientContext, client_context
from .core.config import get_settings
from .core.database import get_session
from .models import Plan
from .plans import TYPE_LABELS, effective_types, features_of
from .quotas import usage

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/plan")
def account_plan(
    ctx: ClientContext = Depends(client_context), session: Session = Depends(get_session)
):
    plan = session.get(Plan, ctx.workspace.plan_id)
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
