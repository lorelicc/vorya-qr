"""Password hashing and opaque tokens (same parameters as Vorya Sign)."""

import hashlib
import secrets
import threading
from datetime import UTC, datetime

from argon2 import PasswordHasher, Type
from argon2.exceptions import Argon2Error

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2, type=Type.ID)
DUMMY_HASH = ph.hash(secrets.token_urlsafe(32))
HASH_SLOTS = threading.BoundedSemaphore(4)
TOKEN_PATTERN = r"^[A-Za-z0-9_-]{43}$"


def now() -> datetime:
    return datetime.now(UTC)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password(value: str) -> str:
    if not 12 <= len(value) <= 128 or not value.strip():
        raise ValueError("La password deve contenere da 12 a 128 caratteri")
    with HASH_SLOTS:
        return ph.hash(value)


def verify_password(value: str, encoded: str | None) -> bool:
    try:
        with HASH_SLOTS:
            return ph.verify(encoded or DUMMY_HASH, value) and encoded is not None
    except (Argon2Error, ValueError):
        return False


def needs_rehash(encoded: str) -> bool:
    return ph.check_needs_rehash(encoded)


def normalized_email(value: str) -> str:
    return str(value).strip().casefold()
