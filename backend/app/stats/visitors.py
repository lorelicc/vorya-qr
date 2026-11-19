"""Daily unique-visitor estimate without storing IPs.

hash = HMAC-SHA256(daily_salt, ip + user agent), truncated to 64 bits. The salt is random,
lives one day in the database and is then deleted by the worker: after that no one, not even
us, can recompute or link the hashes. Unique counts are therefore per day only ("stima")."""

import hashlib
import hmac
import secrets
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..models import DailySalt


def salt_for(session: Session, day: date) -> bytes:
    session.execute(
        insert(DailySalt).values(day=day, salt=secrets.token_bytes(32)).on_conflict_do_nothing()
    )
    return session.scalar(select(DailySalt.salt).where(DailySalt.day == day))


def visitor_hash(salt: bytes, ip: str, user_agent: str) -> str:
    return hmac.new(salt, f"{ip}|{user_agent[:512]}".encode(), hashlib.sha256).hexdigest()[:16]


def drop_old_salts(session: Session, today: date) -> int:
    return session.execute(delete(DailySalt).where(DailySalt.day < today)).rowcount
