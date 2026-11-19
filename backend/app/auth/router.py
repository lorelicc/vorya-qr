from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..access import workspace_access
from ..core.config import get_settings
from ..core.database import get_session
from ..core.security import digest, hash_password, needs_rehash, now, verify_password
from ..mail.templates import send_password_reset
from ..models import AuthSession, PasswordReset, User
from ..schemas.auth import EmailInput, LoginInput, Me, ResetInput, WorkspaceSummary
from .deps import Auth, current_auth, owned_workspace
from .service import (
    SESSION_COOKIE,
    audit,
    check_origin,
    clear_session_cookies,
    client_ip,
    issue_token,
    rate_limit,
    revoke_sessions,
    set_session_cookies,
    start_session,
    too_many,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
NEUTRAL = (
    "Se l'indirizzo è associato a un account, riceverai un'email con le istruzioni "
    "per reimpostare la password."
)
INVALID_LINK = "Link non valido, scaduto o già utilizzato."


def build_me(session: Session, user: User) -> Me:
    workspace = owned_workspace(session, user)
    summary = (
        WorkspaceSummary(
            id=workspace.id,
            name=workspace.name,
            plan_id=workspace.plan_id,
            access=workspace_access(workspace),
            trial_ends_at=workspace.trial_ends_at,
        )
        if workspace
        else None
    )
    return Me(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        role=user.role,
        workspace=summary,
        last_company_id=user.last_company_id,
        support_email=get_settings().support_email,
    )


@router.post("/login", response_model=Me)
def login(
    payload: LoginInput,
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
):
    check_origin(request)
    if not rate_limit(session, "login-ip", client_ip(request), 60) or not rate_limit(
        session, "login-email", payload.email, 8
    ):
        raise too_many()
    user = session.scalar(select(User).where(User.email == payload.email).with_for_update())
    valid = verify_password(payload.password, user.password_hash if user else None)
    if not valid or user is None or not user.is_active or user.deleted_at:
        session.rollback()
        raise HTTPException(401, "Email o password non valide.")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    previous = request.cookies.get(SESSION_COOKIE, "")
    if previous:
        session.execute(delete(AuthSession).where(AuthSession.token_hash == digest(previous)))
    token, csrf = start_session(session, user, payload.remember)
    audit(session, user, "login.success")
    session.commit()
    set_session_cookies(response, token, csrf, payload.remember)
    return build_me(session, user)


@router.get("/me", response_model=Me)
def me(auth: Auth = Depends(current_auth), session: Session = Depends(get_session)):
    return build_me(session, auth.user)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    auth: Auth = Depends(current_auth),
    session: Session = Depends(get_session),
):
    session.delete(auth.session_row)
    session.commit()
    clear_session_cookies(response)


@router.post("/forgot-password")
def forgot_password(
    payload: EmailInput,
    request: Request,
    tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    check_origin(request)
    ip_ok = rate_limit(session, "forgot-ip", client_ip(request), 15)
    email_ok = rate_limit(session, "forgot-email", payload.email, 5)
    if not (ip_ok and email_ok):
        return {"message": NEUTRAL}
    user = session.scalar(
        select(User).where(
            User.email == payload.email, User.is_active.is_(True), User.deleted_at.is_(None)
        )
    )
    if user:
        token = issue_token(session, user, "reset", minutes=30)
        audit(session, user, "password.requested")
        session.commit()
        tasks.add_task(send_password_reset, user.email, user.display_name, token)
    return {"message": NEUTRAL}


@router.post("/reset-password")
def reset_password(payload: ResetInput, request: Request, session: Session = Depends(get_session)):
    check_origin(request)
    if not rate_limit(session, "reset-ip", client_ip(request), 30):
        raise too_many()
    row = session.scalar(
        select(PasswordReset)
        .where(PasswordReset.token_hash == digest(payload.token))
        .with_for_update()
    )
    if row is None or row.purpose != "reset" or row.expires_at <= now():
        raise HTTPException(400, INVALID_LINK)
    user = session.get(User, row.user_id, with_for_update=True)
    if user is None or not user.is_active or user.deleted_at:
        raise HTTPException(400, INVALID_LINK)
    user.password_hash = hash_password(payload.password)
    session.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id))
    revoke_sessions(session, user.id)
    audit(session, user, "password.changed")
    session.commit()
    return {"message": "Password aggiornata. Accedi con la nuova password."}
