from datetime import timedelta

from sqlalchemy import select

from app.core.security import now
from app.models import User, Workspace
from tests.conftest import (
    ORIGIN,
    PASSWORD,
    csrf,
    last_mail,
    login,
    register,
    signup,
    token_from,
)


def test_health(client):
    body = client.get("/health").json()
    assert body == {"status": "ok", "database": "connected", "version": "0.4.0"}


def test_openapi_disabled_outside_development(client):
    assert client.get("/api/openapi.json").status_code == 404


def test_registration_creates_pro_trial_workspace(client, db):
    me = signup(client)
    assert me["role"] == "company_admin"
    assert me["workspace"]["plan_id"] == "pro"
    assert me["workspace"]["access"] == "trial"
    workspace = db.scalar(select(Workspace))
    remaining = workspace.trial_ends_at - now()
    assert timedelta(days=13, hours=23) < remaining <= timedelta(days=14)
    assert client.cookies.get("vorya_qr_session")
    assert client.cookies.get("vorya_qr_csrf")
    assert client.get("/api/auth/me").json()["email"] == "cliente@example.com"


def test_verification_mail_uses_fragment_and_sender(client):
    register(client)
    mail = last_mail("verify", "cliente@example.com")
    assert "http://testserver/verify-email#" in mail["text"]
    assert "?" not in mail["text"].split("verify-email")[1].split()[0]


def test_unverified_user_cannot_login(client):
    register(client)
    assert login(client, "cliente@example.com").status_code == 401


def test_reregistration_never_plants_a_password(client, db):
    first = register(client)
    second = register(client, workspace="Altro nome")
    response = client.post(
        "/api/auth/verify-email",
        json={"token": first, "password": PASSWORD, "confirm_password": PASSWORD},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 400  # previous link invalidated
    assert db.scalar(select(User)).password_hash is None
    assert second


def test_registration_of_existing_account_is_neutral(client):
    signup(client)
    client.cookies.clear()
    response = client.post(
        "/api/auth/register",
        json={
            "email": "cliente@example.com",
            "display_name": "Altro",
            "workspace_name": "Altro",
            "accept_terms": True,
        },
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 202
    assert login(client, "cliente@example.com").status_code == 200


def test_registration_requires_terms(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "x@example.com",
            "display_name": "Mario",
            "workspace_name": "Azienda",
            "accept_terms": False,
        },
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "accept_terms"


def test_login_logout_and_wrong_password(client):
    signup(client)
    client.cookies.clear()
    assert login(client, "cliente@example.com", "password-sbagliata").status_code == 401
    response = login(client, "cliente@example.com")
    assert response.status_code == 200
    assert client.post("/api/auth/logout", headers=csrf(client)).status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_login_rejects_foreign_origin(client):
    signup(client)
    response = client.post(
        "/api/auth/login",
        json={"email": "cliente@example.com", "password": PASSWORD},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403


def test_mutations_require_csrf_token(client):
    signup(client)
    response = client.post("/api/auth/logout", headers={"Origin": ORIGIN})
    assert response.status_code == 403
    response = client.post("/api/auth/logout", headers={"Origin": ORIGIN, "X-CSRF-Token": "x" * 43})
    assert response.status_code == 403


def test_login_rate_limit(client):
    signup(client)
    client.cookies.clear()
    codes = [login(client, "cliente@example.com", "sbagliata-123456").status_code for _ in range(9)]
    assert codes[-1] == 429


def test_password_reset_flow_revokes_sessions(client):
    signup(client)
    other = client.cookies.get("vorya_qr_session")
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "cliente@example.com"},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    token = token_from(last_mail("reset", "cliente@example.com"))
    new_password = "nuova-password-sicura-456"
    response = client.post(
        "/api/auth/reset-password",
        json={"token": token, "password": new_password, "confirm_password": new_password},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    client.cookies.set("vorya_qr_session", other)
    assert client.get("/api/auth/me").status_code == 401
    assert login(client, "cliente@example.com").status_code == 401
    assert login(client, "cliente@example.com", new_password).status_code == 200


def test_forgot_password_is_neutral_for_unknown_email(client):
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "nessuno@example.com"},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200
    assert "Se l'indirizzo" in response.json()["message"]
