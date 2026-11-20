"""Production readiness: protected detailed health, request ids, security headers, scrubbing."""

import json
import logging

from app.core.config import get_settings
from app.core.observability import EMAIL, JsonFormatter, scrub


def with_token(monkeypatch, value="secret-health-token"):
    from pydantic import SecretStr

    monkeypatch.setattr(get_settings(), "health_token", SecretStr(value))


def test_detailed_health_is_protected_and_complete(client, monkeypatch):
    assert client.get("/health/detail").status_code == 404  # disabled until a token is set
    with_token(monkeypatch)
    assert client.get("/health/detail").status_code == 403
    assert client.get("/health/detail", headers={"X-Health-Token": "wrong"}).status_code == 403
    ok = client.get("/health/detail", headers={"X-Health-Token": "secret-health-token"})
    body = ok.json()
    assert ok.status_code == 200 and body["database"]["ok"] and body["storage"]["ok"]
    assert body["database"]["migration"] and body["smtp"]["transport"] == "file"
    assert (
        "queues" in body and "worker" in body
    )  # worker is not running in tests: reported, not hidden


def test_worker_heartbeat_makes_the_worker_check_pass(client, monkeypatch):
    from app.health import beat

    with_token(monkeypatch)
    beat()
    body = client.get("/health/detail", headers={"X-Health-Token": "secret-health-token"}).json()
    assert body["worker"]["ok"] is True and body["worker"]["seconds_since_heartbeat"] < 30


def test_request_id_and_security_headers_on_api_responses(client):
    response = client.get("/health", headers={"X-Request-ID": "abc12345-req"})
    assert response.headers["x-request-id"] == "abc12345-req"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "referrer-policy" in response.headers and "permissions-policy" in response.headers
    fresh = client.get("/health", headers={"X-Request-ID": "<bad id>"})
    assert fresh.headers["x-request-id"] != "<bad id>" and len(fresh.headers["x-request-id"]) == 16


def test_json_logs_carry_the_request_id_and_hide_emails():
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "ciao mario@example.com", None, None)
    line = json.loads(JsonFormatter().format(record))
    assert line["msg"] == "ciao <email>" and "request_id" in line and line["level"] == "INFO"


def test_error_reports_are_scrubbed_of_personal_data():
    event = {
        "user": {"email": "a@b.it"}, "extra": {"x": 1}, "breadcrumbs": {"values": []},
        "request": {"url": "https://qr.vorya.it/api/x?token=abc", "data": {"password": "x"},
                    "cookies": {"s": "1"}, "headers": {"cookie": "s=1"}, "query_string": "token=abc"},
        "exception": {"values": [{"value": "bad mail mario@example.com",
                                  "stacktrace": {"frames": [{"vars": {"p": "secret"}}]}}]},
    }  # fmt: skip
    out = scrub(event, {})
    assert "user" not in out and "extra" not in out and "breadcrumbs" not in out
    assert out["request"] == {"url": "https://qr.vorya.it/api/x"}
    value = out["exception"]["values"][0]
    assert (
        "mario@example.com" not in value["value"] and "vars" not in value["stacktrace"]["frames"][0]
    )
    assert EMAIL.search("x@y.it")


def test_smtp_config_problems_are_reported_without_secrets(monkeypatch):
    from pydantic import SecretStr

    from app.mail import check

    s = get_settings()
    monkeypatch.setattr(s, "mail_transport", "smtp")
    monkeypatch.setattr(s, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(s, "smtp_user", "noreply@vorya.it")
    monkeypatch.setattr(s, "smtp_password", SecretStr(""))
    monkeypatch.setattr(s, "smtp_from_email", "noreply@altro-dominio.it")
    problems = check.config_problems()
    assert any("SMTP_PASSWORD" in p for p in problems) and any("SPF" in p for p in problems)
    assert check.smtp_status()["ok"] is False
