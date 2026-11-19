"""Upgrade a populated 0.2 database to head: links, pages and stats must stay identical."""

import json
from pathlib import Path

from alembic import command
from sqlalchemy import text

from app.core.database import get_engine
from tests.test_migration_v01 import alembic
from tests.test_pages_types import vcard_page

ROOT = Path(__file__).resolve().parent.parent


def test_populated_v02_database_upgrades_without_regressions(monkeypatch, client):
    cfg = alembic(monkeypatch)
    command.downgrade(cfg, "0007_abuse")
    page = {**vcard_page(), "schema_version": 1}
    with get_engine().begin() as c:
        c.execute(text(
            "INSERT INTO users (id, display_name, email, role, is_active, email_verified_at) "
            "VALUES (1, 'Mario', 'mario@example.com', 'company_admin', true, now())"
        ))  # fmt: skip
        c.execute(text(
            "INSERT INTO workspaces (id, name, owner_user_id, plan_id, status) "
            "VALUES (1, 'Pizzeria', 1, 'pro', 'active')"
        ))  # fmt: skip
        c.execute(text("INSERT INTO companies (id, workspace_id, name) VALUES (1, 1, 'Pizzeria')"))
        c.execute(text(
            "INSERT INTO qr_codes (id, workspace_id, company_id, name, kind, qr_type, destination,"
            " target_url, slug, status, design) VALUES "
            "(1, 1, 1, 'Menu', 'dynamic', 'website', 'redirect', 'https://example.com/menu', "
            " 'Ab3dEf7', 'active', CAST(:design AS json)),"
            "(2, 1, 1, 'Giulia', 'dynamic', 'vcard', 'page', '', 'Pg4hJk8', 'active', NULL),"
            "(3, 1, 1, 'Wifi', 'static', 'wifi', 'redirect', '', NULL, 'active', NULL)"
        ), {"design": json.dumps({"modules": "dots"})})  # fmt: skip
        c.execute(
            text("INSERT INTO qr_pages (qr_code_id, schema_version, template, document) "
                 "VALUES (2, 1, 'vcard', CAST(:doc AS json))"),
            {"doc": json.dumps(page)},
        )  # fmt: skip
        c.execute(text(
            "INSERT INTO scan_events (qr_code_id, device_type, os, browser, is_bot) VALUES "
            "(1, 'mobile', 'iOS', 'Safari', false), (1, 'mobile', 'iOS', 'Safari', false), "
            "(1, 'other', 'Altro', 'curl', true)"
        ))  # fmt: skip
    command.upgrade(cfg, "head")

    with get_engine().connect() as c:
        rows = c.execute(text(
            "SELECT id, slug, has_qr, scan_total, design::text FROM qr_codes ORDER BY id"
        )).all()  # fmt: skip
        outcomes = c.execute(text("SELECT DISTINCT outcome FROM scan_events")).scalars().all()
        pro = c.execute(text("SELECT features FROM plans WHERE id = 'pro'")).scalar_one()
        reserved = c.execute(text("SELECT count(*) FROM reserved_words")).scalar_one()
    assert [(r.slug, r.has_qr, r.scan_total) for r in rows] == [
        ("Ab3dEf7", True, 2), ("Pg4hJk8", True, 0), (None, True, 0)]  # fmt: skip
    assert json.loads(rows[0].design) == {"modules": "dots"}
    assert outcomes == ["ok"]
    assert pro["max_bulk_rows"] == 500 and pro["storage_mb"] == 1024  # merged, not replaced
    assert reserved > 50

    hop = client.get("/r/Ab3dEf7", follow_redirects=False)
    assert hop.status_code == 302 and hop.headers["location"] == "https://example.com/menu"
    page_hop = client.get("/r/Pg4hJk8", follow_redirects=False)
    assert page_hop.headers["x-vorya-destination"] == "page"
    assert page_hop.headers["x-vorya-slug"] == "Pg4hJk8"
    assert client.get("/api/public/pages/Pg4hJk8").json()["page"]["template"] == "vcard"

    with get_engine().begin() as c:
        c.execute(text(
            "TRUNCATE scan_events, qr_pages, qr_codes, companies, workspaces, users "
            "RESTART IDENTITY CASCADE"
        ))  # fmt: skip
