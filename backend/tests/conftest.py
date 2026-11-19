"""Tests run against a dedicated PostgreSQL database whose name ends with `_test`.

The schema is dropped and rebuilt through the real Alembic migrations once per session;
every test then starts from truncated tables and the seeded plans.
"""

import json
import os
import re
import shutil
import tempfile
from pathlib import Path

import pytest

TEST_URL = os.environ.get("TEST_DATABASE_URL", "")
if not TEST_URL.rsplit("/", 1)[-1].endswith("_test"):
    raise RuntimeError("Imposta TEST_DATABASE_URL verso un database dedicato che termina con _test")

MAIL_DIR = tempfile.mkdtemp(prefix="vorya-qr-mail-")
STORAGE_DIR = tempfile.mkdtemp(prefix="vorya-qr-files-")
os.environ.update(
    DATABASE_URL=TEST_URL,
    APP_ENV="test",
    MAIL_TRANSPORT="file",
    MAIL_FILE_DIR=MAIL_DIR,
    PUBLIC_BASE_URL="http://testserver",
    SHORT_LINK_BASE_URL="http://testserver",
    SUPPORT_EMAIL="supporto@example.com",
    STORAGE_DRIVER="local",
    STORAGE_LOCAL_PATH=STORAGE_DIR,
)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import get_engine, session_factory  # noqa: E402
from app.main import app  # noqa: E402
from app.migrate import migrate  # noqa: E402

ORIGIN = "http://testserver"
PASSWORD = "una-password-sicura-123"
MUTABLE = ", ".join([
    "link_versions", "utm_templates", "link_aliases", "abuse_reports", "blocked_domains",
    "page_events",
    "daily_salts", "style_presets", "files", "company_transfers", "scan_events", "qr_codes",
    "companies", "audit_logs", "registrations", "password_resets", "auth_sessions",
    "auth_rate_limits", "mail_logs", "workspaces", "users",
])  # fmt: skip
PLAN_SNAPSHOT: list[dict] = []  # plans as seeded by the migrations, restored before each test


@pytest.fixture(scope="session", autouse=True)
def database():
    with get_engine().begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    migrate(TEST_URL)
    with get_engine().connect() as connection:
        PLAN_SNAPSHOT[:] = [
            dict(row._mapping)
            for row in connection.execute(
                text(
                    "SELECT id, name, max_qr_static, max_dynamic_qr, max_companies, features "
                    "FROM plans"
                )
            )
        ]
    yield


@pytest.fixture(autouse=True)
def clean(database):
    with get_engine().begin() as connection:
        connection.execute(text(f"TRUNCATE {MUTABLE} RESTART IDENTITY CASCADE"))
        for plan in PLAN_SNAPSHOT:
            connection.execute(
                text(
                    "UPDATE plans SET name=:name, max_qr_static=:max_qr_static, "
                    "max_dynamic_qr=:max_dynamic_qr, max_companies=:max_companies, "
                    "features=CAST(:features AS json) WHERE id=:id"
                ),
                {**plan, "features": json.dumps(plan["features"])},
            )
    for file in Path(MAIL_DIR).glob("*.json"):
        file.unlink()
    shutil.rmtree(Path(STORAGE_DIR) / "files", ignore_errors=True)
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
    return re.search(r"[#=]([A-Za-z0-9_-]{43})", mail["text"]).group(1)


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


def company_id(client: TestClient) -> int:
    return client.get("/api/auth/me").json()["last_company_id"]


def qrs(client: TestClient) -> str:
    """Base URL of the QR codes of the logged-in user's current company."""
    return f"/api/companies/{company_id(client)}/qr-codes"
