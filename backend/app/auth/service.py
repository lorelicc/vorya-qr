"""Session, cookie, rate-limit and audit helpers shared by auth and onboarding."""

import ipaddress
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import digest, new_token, now
from ..models import AuditLog, AuthRateLimit, AuthSession, PasswordReset, User

SESSION_COOKIE = "vorya_qr_session"
CSRF_COOKIE = "vorya_qr_csrf"
SESSION_HOURS = 8
REMEMBER_DAYS = 30


def audit(session: Session, actor: User | None, action: str, workspace_id=None, **details):
    session.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            workspace_id=workspace_id,
            action=action,
            details=details,
        )
    )


def expected_origin(request: Request) -> str:
    settings = get_settings()
    if settings.is_production:
        return settings.public_base_url
    return request.headers.get("x-vorya-public-origin") or str(request.base_url).rstrip("/")


def check_origin(request: Request) -> None:
    expected = expected_origin(request)
    if not expected or request.headers.get("origin") != expected:
        raise HTTPException(403, "Origine della richiesta non consentita.")


def client_ip(request: Request) -> str:
    """Used only as a rate-limit key (hashed); never persisted in clear."""
    raw = request.headers.get("x-vorya-client-ip") or (
        request.client.host if request.client else ""
    )
    try:
        return str(ipaddress.ip_address(raw))
    except ValueError:
        return "unknown"


def rate_limit(session: Session, scope: str, identifier: str, maximum: int, seconds=900) -> bool:
    bucket = int(now().timestamp()) // seconds
    key = digest(f"{scope}:{bucket}:{identifier}")
    stmt = insert(AuthRateLimit).values(
        key=key, hits=1, expires_at=datetime.fromtimestamp((bucket + 1) * seconds, UTC)
    )
    hits = session.scalar(
        stmt.on_conflict_do_update(
            index_elements=["key"], set_={"hits": AuthRateLimit.hits + 1}
        ).returning(AuthRateLimit.hits)
    )
    session.execute(
        delete(AuthRateLimit).where(AuthRateLimit.expires_at < now() - timedelta(days=1))
    )
    session.commit()
    return hits <= maximum


def too_many(seconds: int = 900) -> HTTPException:
    return HTTPException(
        429, "Troppi tentativi. Riprova tra qualche minuto.", headers={"Retry-After": str(seconds)}
    )


def issue_token(session: Session, user: User, purpose: str, minutes: int) -> str:
    session.execute(
        delete(PasswordReset).where(
            PasswordReset.user_id == user.id, PasswordReset.purpose == purpose
        )
    )
    token = new_token()
    session.add(
        PasswordReset(
            token_hash=digest(token),
            user_id=user.id,
            purpose=purpose,
            expires_at=now() + timedelta(minutes=minutes),
        )
    )
    return token


def start_session(session: Session, user: User, remember: bool) -> tuple[str, str]:
    token, csrf = new_token(), secrets.token_urlsafe(32)
    lifetime = timedelta(days=REMEMBER_DAYS) if remember else timedelta(hours=SESSION_HOURS)
    session.add(
        AuthSession(
            token_hash=digest(token),
            csrf_hash=digest(csrf),
            user_id=user.id,
            expires_at=now() + lifetime,
        )
    )
    user.last_login_at = now()
    return token, csrf


def revoke_sessions(session: Session, user_id: int) -> None:
    session.execute(delete(AuthSession).where(AuthSession.user_id == user_id))


def _cookie_options(httponly: bool) -> dict:
    return {
        "httponly": httponly,
        "secure": get_settings().is_production,
        "samesite": "lax",
        "path": "/",
    }


def set_session_cookies(response: Response, token: str, csrf: str, remember: bool) -> None:
    extra = {"max_age": REMEMBER_DAYS * 86400} if remember else {}
    response.set_cookie(SESSION_COOKIE, token, **_cookie_options(True), **extra)
    response.set_cookie(CSRF_COOKIE, csrf, **_cookie_options(False), **extra)


def clear_session_cookies(response: Response) -> None:
    for key in (SESSION_COOKIE, CSRF_COOKIE):
        response.delete_cookie(key, **_cookie_options(key == SESSION_COOKIE))
