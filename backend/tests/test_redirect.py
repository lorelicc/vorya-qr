from datetime import timedelta

from sqlalchemy import func, select, update

from app.core.security import now
from app.models import ScanEvent, Workspace
from app.redirect.useragent import classify
from tests.conftest import csrf, qrs, signup
from tests.test_qr import URL, create

IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)
DESKTOP = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0 Safari/537.36"
)


def scans(db) -> int:
    return db.scalar(select(func.count()).select_from(ScanEvent))


def follow(client, slug, ua=IPHONE, **headers):
    return client.get(f"/r/{slug}", headers={"User-Agent": ua, **headers}, follow_redirects=False)


def test_redirect_is_302_no_store_and_records_scan(client, db):
    signup(client)
    qr = create(client).json()
    response = follow(client, qr["slug"], Referer="https://instagram.com/p/123")
    assert response.status_code == 302
    assert response.headers["location"] == URL
    assert response.headers["cache-control"] == "no-store"
    event = db.scalar(select(ScanEvent))
    assert (event.device_type, event.os, event.is_bot) == ("mobile", "iOS", False)
    assert event.referrer_host == "instagram.com"
    columns = set(ScanEvent.__table__.columns.keys())
    assert not columns & {"ip", "ip_address", "latitude", "longitude"}  # 0.2: only country/city


def test_destination_change_applies_immediately(client):
    signup(client)
    qr = create(client).json()
    body = {"name": qr["name"], "target_url": "https://example.com/nuova"}
    client.put(f"{qrs(client)}/{qr['id']}", json=body, headers=csrf(client))
    assert follow(client, qr["slug"]).headers["location"] == "https://example.com/nuova"


def test_paused_qr_shows_inactive_page(client, db):
    signup(client)
    qr = create(client).json()
    client.post(f"{qrs(client)}/{qr['id']}/pause", headers=csrf(client))
    response = follow(client, qr["slug"])
    assert response.status_code == 410
    assert "QR non attivo" in response.text
    assert response.headers["cache-control"] == "no-store"
    assert scans(db) == 0


def test_deleted_and_unknown_qr(client):
    signup(client)
    qr = create(client).json()
    client.delete(f"{qrs(client)}/{qr['id']}", headers=csrf(client))
    assert follow(client, qr["slug"]).status_code == 410
    assert follow(client, "zzzzzzz").status_code == 404
    assert follow(client, "bad").status_code == 404


def test_suspended_workspace_blocks_redirect(client, db):
    signup(client)
    qr = create(client).json()
    db.execute(update(Workspace).values(status="suspended"))
    db.commit()
    assert follow(client, qr["slug"]).status_code == 410
    assert scans(db) == 0


def test_expired_trial_keeps_redirects_and_scans(client, db):
    signup(client)
    qr = create(client).json()
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(days=1)))
    db.commit()
    response = follow(client, qr["slug"])
    assert response.status_code == 302 and response.headers["location"] == URL
    assert scans(db) == 1


def test_head_request_redirects_without_counting(client, db):
    signup(client)
    qr = create(client).json()
    response = client.head(f"/r/{qr['slug']}", follow_redirects=False)
    assert response.status_code == 302
    assert scans(db) == 0


def test_bots_are_flagged_and_excluded_from_stats(client):
    signup(client)
    qr = create(client).json()
    follow(client, qr["slug"])
    follow(client, qr["slug"], ua=DESKTOP)
    follow(client, qr["slug"], ua="WhatsApp/2.24.1 A")
    follow(client, qr["slug"], ua="")
    stats = client.get(f"{qrs(client)}/{qr['id']}/stats").json()
    assert stats["total_scans"] == 2
    assert stats["bot_scans"] == 2
    assert stats["scans_last_30_days"] == 2
    assert len(stats["daily"]) == 30 and stats["daily"][-1]["count"] == 2
    assert {d["label"] for d in stats["devices"]} == {"Smartphone", "Computer"}
    assert {o["label"] for o in stats["os"]} == {"iOS", "Windows"}
    assert client.get(f"{qrs(client)}").json()[0]["scan_count"] == 2


def test_stats_only_for_dynamic(client):
    signup(client)
    qr = create(client, kind="static").json()
    assert client.get(f"{qrs(client)}/{qr['id']}/stats").status_code == 409


def test_useragent_classification():
    assert classify(IPHONE).device_type == "mobile"
    assert classify(DESKTOP).device_type == "desktop"
    ipad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"
    assert classify(ipad).device_type == "tablet"
    assert classify("Mozilla/5.0 (compatible; Googlebot/2.1)").is_bot
    assert classify("").is_bot
