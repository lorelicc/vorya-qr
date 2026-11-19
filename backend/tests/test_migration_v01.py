"""Upgrade a populated 0.1 database to head: printed QR codes must keep working identically."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.database import get_engine
from tests.conftest import TEST_URL

ROOT = Path(__file__).resolve().parent.parent


def alembic(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", TEST_URL)
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    return cfg


def test_populated_v01_database_upgrades_without_regressions(monkeypatch, client):
    cfg = alembic(monkeypatch)
    command.downgrade(cfg, "0001_initial")
    with get_engine().begin() as c:
        c.execute(text(
            "INSERT INTO users (id, display_name, email, role, is_active, email_verified_at) "
            "VALUES (1, 'Mario', 'mario@example.com', 'company_admin', true, now()), "
            "(2, 'Anna', 'anna@example.com', 'company_admin', true, now())"
        ))  # fmt: skip
        c.execute(text(
            "INSERT INTO workspaces (id, name, owner_user_id, plan_id, status) VALUES "
            "(1, 'Pizzeria Da Mario', 1, 'pro', 'active'), (2, 'Studio Anna', 2, 'start', 'active')"
        ))  # fmt: skip
        c.execute(text(
            "INSERT INTO qr_codes (id, workspace_id, name, kind, target_url, slug, status) VALUES "
            "(1, 1, 'Menu', 'dynamic', 'https://example.com/menu', 'Ab3dEf7', 'active'), "
            "(2, 1, 'Pausa', 'dynamic', 'https://example.com/p', 'Zx9kLm2', 'paused'), "
            "(3, 2, 'Sito', 'static', 'https://anna.example.com', NULL, 'active')"
        ))  # fmt: skip
        c.execute(text(
            "INSERT INTO scan_events (qr_code_id, device_type, os, browser, is_bot) "
            "VALUES (1, 'mobile', 'iOS', 'Mobile Safari', false)"
        ))  # fmt: skip
    command.upgrade(cfg, "head")

    with get_engine().connect() as c:
        companies = c.execute(
            text("SELECT workspace_id, name FROM companies ORDER BY workspace_id")
        ).all()
        qr = c.execute(
            text(
                "SELECT id, company_id, slug, target_url, status, qr_type, destination, "
                "static_data FROM qr_codes ORDER BY id"
            )
        ).all()
        features = (
            c.execute(text("SELECT max_companies FROM plans ORDER BY position")).scalars().all()
        )
    assert companies == [(1, "Pizzeria Da Mario"), (2, "Studio Anna")]
    assert [row.slug for row in qr] == ["Ab3dEf7", "Zx9kLm2", None]
    assert qr[0].company_id != qr[2].company_id
    assert [(r.qr_type, r.destination) for r in qr] == [("website", "redirect")] * 3
    assert qr[2].static_data == {"url": "https://anna.example.com"} and qr[0].static_data is None
    assert features == [1, 3, 10]

    response = client.get("/r/Ab3dEf7", follow_redirects=False)
    assert (
        response.status_code == 302 and response.headers["location"] == "https://example.com/menu"
    )
    assert client.get("/r/Zx9kLm2", follow_redirects=False).status_code == 410

    with get_engine().begin() as c:  # reset ids for the following tests
        c.execute(text(
            "TRUNCATE scan_events, qr_codes, companies, workspaces, users RESTART IDENTITY CASCADE"
        ))  # fmt: skip
