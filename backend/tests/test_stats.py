from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update

from app.core.security import now
from app.main import app
from app.models import DailySalt, PageEvent, Plan, ScanEvent
from app.stats import geo
from app.stats.periods import local_today, resolve
from app.worker import rotate_salts, stats_retention
from tests.conftest import ORIGIN, qrs, signup
from tests.test_pages_types import create_page_qr, vcard_page
from tests.test_qr import create
from tests.test_redirect import DESKTOP, IPHONE, follow

PUBLIC_IP = "93.184.216.34"


class FakeReader:
    def get(self, ip):
        return {"country": {"iso_code": "IT"}, "city": {"names": {"it": "Milano", "en": "Milan"}}}


@pytest.fixture
def fake_geo(monkeypatch):
    monkeypatch.setattr(geo, "reader", lambda: FakeReader())


def test_scan_gets_place_and_daily_hash_but_never_the_ip(client, db, fake_geo):
    signup(client)
    qr = create(client).json()
    for ua in (IPHONE, IPHONE, DESKTOP):
        follow(client, qr["slug"], ua=ua, **{"X-Vorya-Client-IP": PUBLIC_IP})
    events = db.scalars(select(ScanEvent)).all()
    assert {(e.country_code, e.city) for e in events} == {("IT", "Milano")}
    hashes = [e.visitor_hash for e in events]
    assert hashes[0] == hashes[1] != hashes[2] and len(hashes[0]) == 16
    names = [c.key for c in ScanEvent.__table__.columns]
    stored = " ".join(str(getattr(e, c)) for e in events for c in names)
    assert PUBLIC_IP not in stored
    stats = client.get(f"{qrs(client)}/{qr['id']}/stats").json()
    assert (stats["scans"], stats["unique_estimate"]) == (3, 2)
    assert stats["countries"][0] == {"label": "IT", "key": "IT", "count": 3}
    assert stats["cities"][0]["label"] == "Milano" and stats["geo_available"] is True
    assert stats["attribution"]["url"] == "https://db-ip.com"


def test_missing_geo_database_and_private_ips(client, db, monkeypatch):
    monkeypatch.setattr(geo, "reader", lambda: None)
    assert geo.lookup(PUBLIC_IP) == (None, None)
    monkeypatch.setattr(geo, "reader", lambda: FakeReader())
    assert geo.lookup("10.0.0.1") == (None, None) and geo.lookup("nope") == (None, None)


def test_salts_rotate_and_old_ones_are_destroyed(client, db):
    db.add(DailySalt(day=local_today() - timedelta(days=1), salt=b"x" * 32))
    db.add(DailySalt(day=local_today(), salt=b"y" * 32))
    db.commit()
    assert rotate_salts(db) == 1
    db.commit()
    assert db.scalars(select(DailySalt.day)).all() == [local_today()]


def test_ranges_series_and_retention_clamp():
    today = local_today()
    assert resolve("7d", None, None, None) == (today - timedelta(days=6), today)
    first, last = resolve("90d", None, None, 30)
    assert (last - first).days == 29  # Start-like plan: 30 days visible
    first, _ = resolve("custom", date(2000, 1, 1), today, None)
    assert (today - first).days == 365  # custom ranges are capped to one year


def test_range_parameters_and_company_stats(client, db):
    signup(client)
    a, b = create(client).json(), create(client, name="Secondo").json()
    for qr, n in ((a, 2), (b, 1)):
        for _ in range(n):
            follow(client, qr["slug"])
    old = now() - timedelta(days=20)
    db.execute(update(ScanEvent).where(ScanEvent.id == 1).values(scanned_at=old))
    db.commit()
    week = client.get(f"{qrs(client)}/{a['id']}/stats?range=7d").json()
    assert week["scans"] == 1 and len(week["daily"]) == 7 and week["total_scans"] == 2
    company = qrs(client).replace("/qr-codes", "/stats")
    data = client.get(f"{company}?range=30d").json()
    assert data["scans"] == 3 and [t["count"] for t in data["top_qr"]] == [2, 1]
    custom = client.get(f"{company}?range=custom&start=2020-01-02&end=2020-01-01")
    assert custom.status_code == 422 and custom.json()["code"] == "invalid_range"
    csv = client.get(f"{company}.csv?range=7d")
    assert csv.headers["content-type"].startswith("text/csv")
    lines = csv.text.lstrip("﻿").splitlines()
    assert lines[0] == "data;scansioni;visitatori_unici_stimati;click" and len(lines) == 8


def test_stats_are_scoped_to_the_company(client):
    signup(client)
    qr = create(client).json()
    foreign = qrs(client).replace("/qr-codes", "/stats")
    with TestClient(app, base_url=ORIGIN) as other:
        signup(other, email="altro@example.com")
        assert other.get(f"{qrs(other)}/{qr['id']}/stats").status_code == 404
        assert other.get(foreign).status_code in (403, 404)


def test_page_clicks_are_labelled_server_side(client, db):
    signup(client)
    qr = create_page_qr(client, "vcard", vcard_page()).json()
    url = f"/api/public/pages/{qr['slug']}/events"
    assert client.post(url, json={"block_id": "c", "item": "vcf"}).status_code == 204
    assert client.post(url, json={"block_id": "c", "item": "tel0"}).status_code == 204
    client.post(url, json={"block_id": "zzz", "item": "<b>spam</b>"})  # ignored
    client.post(url, json={"block_id": "c", "item": "vcf"}, headers={"User-Agent": "curl/8"})
    labels = db.scalars(select(PageEvent.label)).all()
    assert sorted(labels) == ["Contatto: salva contatto", "Contatto: telefono"]
    stats = client.get(f"{qrs(client)}/{qr['id']}/stats").json()
    assert stats["clicks"] == 2 and stats["top_clicks"][0]["count"] == 1


def test_retention_job_deletes_old_events_by_plan(client, db):
    signup(client)
    qr = create(client).json()
    follow(client, qr["slug"])
    follow(client, qr["slug"])
    db.execute(
        update(ScanEvent).where(ScanEvent.id == 1).values(scanned_at=now() - timedelta(days=400))
    )
    db.commit()
    assert stats_retention(db) == 1  # trial = Pro: 365 days
    db.commit()
    assert db.scalar(select(func.count()).select_from(ScanEvent)) == 1
    plus = db.get(Plan, "plus")
    assert plus.features.get("stats_retention_days", 0) is None
