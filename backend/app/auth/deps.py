"""Router-level dependencies: authentication, CSRF, roles and workspace ownership."""

import re
import secrets
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..access import ensure_usable
from ..core.database import get_session
from ..core.security import digest, now
from ..models import AuthSession, User, Workspace
from .service import CSRF_COOKIE, SESSION_COOKIE, check_origin

SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


@dataclass
class Auth:
    user: User
    session_row: AuthSession


@dataclass
class ClientContext:
    user: User
    workspace: Workspace
    access: str


def current_auth(request: Request, session: Session = Depends(get_session)) -> Auth:
    token = request.cookies.get(SESSION_COOKIE, "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(401, "Accesso richiesto.")
    row = session.get(AuthSession, digest(token))
    if row is None or row.expires_at <= now():
        raise HTTPException(401, "Sessione scaduta. Accedi di nuovo.")
    user = session.get(User, row.user_id)
    if user is None or not user.is_active or user.deleted_at:
        raise HTTPException(401, "Accesso richiesto.")
    if request.method not in SAFE_METHODS:
        check_origin(request)
        csrf = request.cookies.get(CSRF_COOKIE, "")
        header = request.headers.get("x-csrf-token", "")
        if (
            not csrf
            or not secrets.compare_digest(csrf, header)
            or not secrets.compare_digest(digest(csrf), row.csrf_hash)
        ):
            raise HTTPException(403, "Richiesta non valida. Ricarica la pagina e riprova.")
    return Auth(user=user, session_row=row)


def require_roles(*roles: str):
    def dependency(auth: Auth = Depends(current_auth)) -> Auth:
        if auth.user.role not in roles:
            raise HTTPException(403, "Non hai i permessi per questa operazione.")
        return auth

    return dependency


def admin_reader(auth: Auth = Depends(require_roles("super_admin", "platform_admin"))) -> Auth:
    return auth


def admin_writer(auth: Auth = Depends(require_roles("super_admin"))) -> Auth:
    return auth


def owned_workspace(session: Session, user: User, lock: bool = False) -> Workspace | None:
    query = select(Workspace).where(Workspace.owner_user_id == user.id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return session.scalar(query)


def client_context(
    auth: Auth = Depends(require_roles("company_admin")),
    session: Session = Depends(get_session),
) -> ClientContext:
    workspace = owned_workspace(session, auth.user)
    if workspace is None:
        raise HTTPException(403, "Nessuno spazio di lavoro associato all'account.")
    access = ensure_usable(workspace)
    return ClientContext(user=auth.user, workspace=workspace, access=access)
