"""Tests run against a dedicated PostgreSQL database whose name ends with `_test`.

The schema is dropped and rebuilt through the real Alembic migrations once per session;
every test then starts from truncated tables and the seeded plans.
"""

import json
import os
import re
import tempfile
from pathlib import Path

import pytest

TEST_URL = os.environ.get("TEST_DATABASE_URL", "")
if not TEST_URL.rsplit("/", 1)[-1].endswith("_test"):
    raise RuntimeError("Imposta TEST_DATABASE_URL verso un database dedicato che termina con _test")

MAIL_DIR = tempfile.mkdtemp(prefix="vorya-qr-mail-")
os.environ.update(
    DATABASE_URL=TEST_URL,
    APP_ENV="test",
    MAIL_TRANSPORT="file",
    MAIL_FILE_DIR=MAIL_DIR,
    PUBLIC_BASE_URL="http://testserver",
    SHORT_LINK_BASE_URL="http://testserver",
    SUPPORT_EMAIL="supporto@example.com",
)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import get_engine, session_factory  # noqa: E402
from app.main import app  # noqa: E402
from app.migrate import migrate  # noqa: E402

ORIGIN = "http://testserver"
PASSWORD = "una-password-sicura-123"
MUTABLE = (
    "scan_events, qr_codes, audit_logs, registrations, password_resets, auth_sessions, "
    "auth_rate_limits, mail_logs, workspaces, users"
)
SEED_PLANS = {
    "start": (10, 3),
    "pro": (100, 25),
    "plus": (None, 250),
}


@pytest.fixture(scope="session", autouse=True)
def database():
    with get_engine().begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    migrate(TEST_URL)
    yield


@pytest.fixture(autouse=True)
def clean(database):
    with get_engine().begin() as connection:
        connection.execute(text(f"TRUNCATE {MUTABLE} RESTART IDENTITY CASCADE"))
        for plan_id, (static, dynamic) in SEED_PLANS.items():
            connection.execute(
                text("UPDATE plans SET max_qr_static=:s, max_dynamic_qr=:d WHERE id=:id"),
                {"s": static, "d": dynamic, "id": plan_id},
            )
    for file in Path(MAIL_DIR).glob("*.json"):
        file.unlink()
    yield


@pytest.fixture
def db():
    with session_factory()() as session:
        yield session


@pytest.fixture
def client():
    with TestClient(app, base_url=ORIGIN) as test_client:
        yield test_client


def csrf(client: TestClient) -> dict:
    return {"Origin": ORIGIN, "X-CSRF-Token": client.cookies.get("vorya_qr_csrf", "")}


def last_mail(kind: str, to: str) -> dict:
    files = sorted(Path(MAIL_DIR).glob(f"{kind}-*.json"), key=lambda p: p.stat().st_mtime)
    for file in reversed(files):
        data = json.loads(file.read_text())
        if data["to"] == to:
            return data
    raise AssertionError(f"Nessuna email {kind} per {to}")


def token_from(mail: dict) -> str:
    return re.search(r"#([A-Za-z0-9_-]{43})", mail["text"]).group(1)


def register(client: TestClient, email="cliente@example.com", workspace="Azienda Demo"):
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "display_name": "Mario Rossi",
            "workspace_name": workspace,
            "accept_terms": True,
        },
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 202, response.text
    return token_from(last_mail("verify", email))


def signup(client: TestClient, email="cliente@example.com") -> dict:
    """Registers, verifies and leaves the client logged in. Returns /api/auth/me."""
    token = register(client, email)
    response = client.post(
        "/api/auth/verify-email",
        json={"token": token, "password": PASSWORD, "confirm_password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text
    return response.json()


def make_admin(email="admin@example.com", role="super_admin"):
    from app.cli import create_admin

    create_admin(email, "Admin", role, PASSWORD)


def login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": ORIGIN},
    )
