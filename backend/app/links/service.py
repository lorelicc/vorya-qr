"""Short link rules: back-half aliases, expiry, password and scheduled destinations.

Everything the redirect needs lives on the `qr_codes` row (plus one alias lookup inside the same
statement), so evaluating the rules never adds a query to /r/{slug}.
"""

import hashlib
import hmac
import re
import secrets
import time
from datetime import UTC, datetime, timedelta

from argon2.exceptions import Argon2Error
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..core.errors import CodedError
from ..core.security import HASH_SLOTS, now, ph
from ..models import LinkAlias, PlatformSetting, QrCode, ReservedWord
from ..plans import features_of, locked, plan_of
from ..schemas.qr import valid_url
from .reserved import BLOCKED_WORDS, ROUTE_WORDS

ALIAS = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$")
ALIAS_QUARANTINE = timedelta(days=90)
UNLOCK_SECONDS = 24 * 3600
MAX_SCHEDULE = 20


def field_error(status: int, detail: str, code: str, field: str) -> CodedError:
    error = CodedError(status, detail, code)
    error.field = field  # type: ignore[attr-defined]
    return error


# ---------------------------------------------------------------- aliases


def normalise_alias(value: str) -> str:
    return value.strip().lower()


def alias_problem(session: Session, alias: str, workspace_id: int) -> str | None:
    """None when the back-half can be used by this workspace, else a user-facing reason."""
    if not ALIAS.match(alias) or "--" in alias:
        return (
            "Usa da 3 a 50 caratteri: lettere minuscole, numeri e trattini "
            "(non all'inizio o alla fine)."
        )
    if alias in ROUTE_WORDS or alias in BLOCKED_WORDS or session.get(ReservedWord, alias):
        return "Questa parola è riservata."
    if session.scalar(select(QrCode.id).where(func.lower(QrCode.slug) == alias)):
        return "Questo indirizzo è già in uso."
    existing = session.scalar(select(LinkAlias).where(LinkAlias.alias == alias))
    if existing is None:
        return None
    if existing.removed_at is None:
        return "Questo indirizzo è già in uso."
    if existing.workspace_id != workspace_id and existing.removed_at > now() - ALIAS_QUARANTINE:
        return "Questo indirizzo è stato liberato da poco: sarà disponibile tra qualche settimana."
    return None


def add_alias(session: Session, workspace, link: QrCode, raw: str) -> LinkAlias:
    features = features_of(plan_of(session, workspace))
    if not features.custom_back_half:
        raise locked("Il back-half personalizzato")
    if link.kind != "dynamic":
        raise field_error(409, "Solo i link dinamici hanno un back-half.", "not_dynamic", "alias")
    active = session.scalar(
        select(func.count()).where(LinkAlias.qr_code_id == link.id, LinkAlias.removed_at.is_(None))
    )
    limit = features.max_aliases_per_link
    if limit is not None and active >= limit:
        raise field_error(
            409, f"Il piano consente {limit} back-half per link.", "quota_aliases", "alias"
        )
    alias = normalise_alias(raw)
    problem = alias_problem(session, alias, workspace.id)
    if problem:
        raise field_error(422, problem, "alias_unavailable", "alias")
    session.execute(delete(LinkAlias).where(LinkAlias.alias == alias))  # expired quarantine
    row = LinkAlias(qr_code_id=link.id, workspace_id=workspace.id, alias=alias)
    session.add(row)
    session.flush()
    return row


def slug_taken_by_alias(session: Session, slug: str) -> bool:
    return bool(session.scalar(select(LinkAlias.id).where(LinkAlias.alias == slug.lower())))


# ---------------------------------------------------------------- rules


class ScheduleEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    starts_at: datetime
    url: str = Field(max_length=2048)

    _url = field_validator("url")(classmethod(lambda cls, v: valid_url(v)))

    @field_validator("starts_at")
    @classmethod
    def aware(cls, value: datetime) -> datetime:
        return value if value.tzinfo else value.replace(tzinfo=UTC)


class LinkRules(BaseModel):
    """PUT body. `password`: omitted = unchanged, "" = removed, text = new password."""

    model_config = ConfigDict(extra="forbid")
    expires_at: datetime | None = None
    max_scans: int | None = Field(default=None, ge=1, le=10_000_000)
    fallback_url: str | None = Field(default=None, max_length=2048)
    password: str | None = Field(default=None, max_length=128)
    schedule: list[ScheduleEntry] = Field(default_factory=list, max_length=MAX_SCHEDULE)

    @field_validator("fallback_url")
    @classmethod
    def fallback(cls, value: str | None) -> str | None:
        return valid_url(value) if value else None

    @field_validator("expires_at")
    @classmethod
    def aware(cls, value: datetime | None) -> datetime | None:
        return value.replace(tzinfo=UTC) if value and not value.tzinfo else value


def apply_rules(session: Session, workspace, link: QrCode, rules: LinkRules) -> None:
    if not features_of(plan_of(session, workspace)).link_rules:
        raise locked("Scadenza, password e programmazione")
    if link.kind != "dynamic":
        raise field_error(
            409, "Le regole valgono solo per i link dinamici.", "not_dynamic", "rules"
        )
    link.expires_at, link.max_scans = rules.expires_at, rules.max_scans
    link.fallback_url = rules.fallback_url
    if rules.password is not None:
        if rules.password == "":
            link.password_hash = None
        elif len(rules.password) < 4:
            raise field_error(
                422, "La password deve avere almeno 4 caratteri.", "short", "password"
            )
        else:
            with HASH_SLOTS:
                link.password_hash = ph.hash(rules.password)
    entries = sorted(rules.schedule, key=lambda e: e.starts_at)
    link.schedule = [
        {"starts_at": e.starts_at.astimezone(UTC).isoformat(), "url": e.url} for e in entries
    ] or None


def rules_out(link) -> dict:
    return {
        "expires_at": link.expires_at,
        "max_scans": link.max_scans,
        "fallback_url": link.fallback_url,
        "has_password": bool(link.password_hash),
        "schedule": link.schedule or [],
    }


def is_expired(row, at: datetime) -> bool:
    if row.expires_at and row.expires_at <= at:
        return True
    return bool(row.max_scans and row.scan_total >= row.max_scans)


def scheduled_url(schedule: list | None, at: datetime) -> str | None:
    """The most recent entry already started wins; before the first one, the base target."""
    current = None
    for entry in schedule or []:
        if datetime.fromisoformat(entry["starts_at"]) <= at:
            current = entry["url"]
    return current


# ---------------------------------------------------------------- password unlock


def _secret(session: Session) -> bytes:
    """Random HMAC key created once and kept in platform_settings (no env variable needed)."""
    row = session.get(PlatformSetting, "link_unlock")
    if row is None:
        row = PlatformSetting(key="link_unlock", data={"key": secrets.token_hex(32)})
        session.add(row)
        session.commit()
    return bytes.fromhex(row.data["key"])


def cookie_name(link_id: int) -> str:
    return f"vqr_unlock_{link_id}"


def unlock_token(session: Session, link_id: int, password_hash: str) -> str:
    expires = int(time.time()) + UNLOCK_SECONDS
    return f"{expires}.{_sign(session, link_id, password_hash, expires)}"


def _sign(session, link_id: int, password_hash: str, expires: int) -> str:
    # The password hash is part of the message: changing the password revokes every cookie.
    message = f"{link_id}:{expires}:{hashlib.sha256(password_hash.encode()).hexdigest()}"
    return hmac.new(_secret(session), message.encode(), hashlib.sha256).hexdigest()


def unlocked(session: Session, link_id: int, password_hash: str, token: str | None) -> bool:
    if not token or "." not in token:
        return False
    expires, _, signature = token.partition(".")
    if not expires.isdigit() or int(expires) < time.time():
        return False
    expected = _sign(session, link_id, password_hash, int(expires))
    return hmac.compare_digest(expected, signature)


def check_password(value: str, encoded: str) -> bool:
    try:
        with HASH_SLOTS:
            return ph.verify(encoded, value)
    except (Argon2Error, ValueError):
        return False
