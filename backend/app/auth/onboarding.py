"""Public registration with email verification.

Registration only stores name, workspace name and consent. The password is chosen on the
verification page, so re-registering a pending address can never plant a password.
The workspace (Pro limits, 14-day trial) is created when the address is verified.
"""

from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..companies.service import create_default_company
from ..core.config import get_settings
from ..core.database import get_session
from ..core.security import digest, hash_password, now
from ..mail.templates import send_verification
from ..models import PasswordReset, Plan, PlatformSetting, Registration, User, Workspace
from ..schemas.auth import Me, RegisterInput, VerifyInput
from .router import build_me
from .service import (
    audit,
    check_origin,
    client_ip,
    issue_token,
    rate_limit,
    set_session_cookies,
    start_session,
    too_many,
)

router = APIRouter(prefix="/api/auth", tags=["onboarding"])
CHECK_INBOX = (
    "Controlla la tua casella email: ti abbiamo inviato il link per confermare l'indirizzo."
)
VERIFY_MINUTES = 24 * 60


def trial_settings(session: Session) -> tuple[int, str]:
    row = session.get(PlatformSetting, "general")
    data = row.data if row else {}
    return int(data.get("trial_days", 14)), str(data.get("trial_plan_id", "pro"))


@router.post("/register", status_code=202)
def register(
    payload: RegisterInput,
    request: Request,
    tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    check_origin(request)
    if not get_settings().public_registration_enabled:
        raise HTTPException(403, "La registrazione pubblica non è attiva.")
    if not rate_limit(
        session, "register-ip", client_ip(request), get_settings().register_rate_limit, 3600
    ) or not rate_limit(session, "register-email", payload.email, 3, 3600):
        raise too_many(3600)
    user = session.scalar(select(User).where(User.email == payload.email).with_for_update())
    if user is not None and (user.email_verified_at or user.role != "company_admin"):
        # Same neutral answer: never reveal that an account exists.
        session.commit()
        return {"message": CHECK_INBOX}
    if user is None:
        user = User(email=payload.email, role="company_admin", is_active=False)
        session.add(user)
    user.display_name = payload.display_name
    session.flush()
    registration = session.get(Registration, user.id)
    if registration is None:
        registration = Registration(user_id=user.id, terms_accepted_at=now())
        session.add(registration)
    registration.workspace_name = payload.workspace_name
    registration.terms_accepted_at = now()
    registration.attribution = payload.attribution.model_dump() if payload.attribution else None
    registration.handoff = payload.handoff.model_dump() if payload.handoff else None
    token = issue_token(session, user, "verify", minutes=VERIFY_MINUTES)
    audit(session, None, "registration.requested")
    session.commit()
    tasks.add_task(send_verification, user.email, user.display_name, token)
    return {"message": CHECK_INBOX}


@router.post("/verify-email", response_model=Me)
def verify_email(
    payload: VerifyInput,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
):
    check_origin(request)
    if not rate_limit(session, "verify-ip", client_ip(request), 30):
        raise too_many()
    row = session.scalar(
        select(PasswordReset)
        .where(PasswordReset.token_hash == digest(payload.token))
        .with_for_update()
    )
    invalid = HTTPException(
        400, "Link scaduto o già utilizzato. Ripeti la registrazione per riceverne uno nuovo."
    )
    if row is None or row.purpose != "verify" or row.expires_at <= now():
        raise invalid
    user = session.get(User, row.user_id, with_for_update=True)
    registration = session.get(Registration, row.user_id, with_for_update=True)
    if user is None or registration is None or user.email_verified_at or user.deleted_at:
        raise invalid
    trial_days, trial_plan = trial_settings(session)
    if session.get(Plan, trial_plan) is None:
        raise HTTPException(503, "Piano di prova non disponibile.")
    # The password is chosen here, by whoever holds the emailed link.
    user.password_hash = hash_password(payload.password)
    user.is_active = True
    user.email_verified_at = now()
    registration.verified_at = now()
    workspace = Workspace(
        name=registration.workspace_name,
        owner_user_id=user.id,
        plan_id=trial_plan,
        status="active",
        trial_ends_at=now() + timedelta(days=trial_days),
    )
    session.add(workspace)
    session.flush()
    workspace.attribution = registration.attribution
    company = create_default_company(session, workspace.id, workspace.name)
    user.last_company_id = company.id
    if registration.handoff:
        from .handoff import create_from_handoff

        create_from_handoff(session, user, workspace, company, registration.handoff)
    registration.handoff = None  # used once; nothing about it is kept
    session.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
    token, csrf = start_session(session, user, remember=False)
    audit(session, user, "registration.verified", workspace.id)
    session.commit()
    set_session_cookies(response, token, csrf, remember=False)
    return build_me(session, user)
