from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import event, update

from app.core.database import get_engine
from app.main import app
from app.models import LinkAlias, Plan, ScanEvent, Workspace
from tests.conftest import ORIGIN, csrf, qrs, signup
from tests.test_links import links
from tests.test_pages_types import create_page_qr, vcard_page
from tests.test_redirect import follow


def short_link(client, url="https://example.com/a"):
    return client.post(links(client), json={"target_url": url}, headers=csrf(client)).json()


def add_alias(client, link_id, alias):
    return client.post(f"{qrs(client)}/{link_id}/aliases", json={"alias": alias},
                       headers=csrf(client))  # fmt: skip


def rules(client, link_id, **body):
    return client.put(f"{qrs(client)}/{link_id}/rules", json=body, headers=csrf(client))


def test_alias_is_an_extra_name_and_slug_keeps_working(client):
    signup(client)  # trial = Pro: back-half included, 3 per link
    link = short_link(client)
    created = add_alias(client, link["id"], "Vendemmia2026")
    assert created.status_code == 201 and created.json()["alias"] == "vendemmia2026"
    for name in ("vendemmia2026", "VENDEMMIA2026", link["slug"]):
        assert follow(client, name).headers["location"] == "https://example.com/a", name
    assert add_alias(client, link["id"], "vendemmia2026").status_code == 422  # taken
    for bad in ("ab", "login", "paypal", "-x-", "a_b", "x" * 51):
        assert add_alias(client, link["id"], bad).status_code == 422, bad
    check = client.get(f"{qrs(client)}/aliases/check?alias=Login").json()
    assert check == {"alias": "login", "available": False, "reason": "Questa parola è riservata."}


def test_alias_removal_needs_confirmation_and_quarantine(client, db):
    signup(client)
    link = short_link(client)
    alias = add_alias(client, link["id"], "promo-estate").json()
    url = f"{qrs(client)}/{link['id']}/aliases/{alias['id']}"
    assert client.delete(url, headers=csrf(client)).json()["code"] == "confirm_required"
    assert client.delete(f"{url}?confirm=true", headers=csrf(client)).status_code == 204
    assert follow(client, "promo-estate").status_code == 404
    assert follow(client, link["slug"]).status_code == 302  # the slug never stops working
    # Same account can take it back; another account must wait 90 days.
    with TestClient(app, base_url=ORIGIN) as second:
        signup(second, email="altro@example.com")
        mine = short_link(second)
        assert add_alias(second, mine["id"], "promo-estate").status_code == 422
        db.execute(update(LinkAlias).values(removed_at=datetime.now(UTC) - timedelta(days=91)))
        db.commit()
        assert add_alias(second, mine["id"], "promo-estate").status_code == 201


def test_back_half_is_locked_on_start(client, db):
    signup(client)
    db.execute(update(Workspace).values(plan_id="start", trial_ends_at=None))
    db.commit()
    link = short_link(client)
    assert add_alias(client, link["id"], "promo").json()["code"] == "feature_locked"
    assert rules(client, link["id"], max_scans=3).json()["code"] == "feature_locked"


def test_max_aliases_per_link(client, db):
    signup(client)
    plan = db.get(Plan, "pro")
    plan.features = {**plan.features, "max_aliases_per_link": 1}
    db.commit()
    link = short_link(client)
    assert add_alias(client, link["id"], "uno").status_code == 201
    assert add_alias(client, link["id"], "due").json()["code"] == "quota_aliases"


def test_expiry_by_date_and_by_scans_with_fallback(client):
    signup(client)
    link = short_link(client)
    past = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    assert rules(client, link["id"], expires_at=past).status_code == 200
    expired = follow(client, link["slug"])
    assert expired.status_code == 410 and "Link scaduto" in expired.text
    rules(client, link["id"], expires_at=past, fallback_url="https://example.com/fine")
    assert follow(client, link["slug"]).headers["location"] == "https://example.com/fine"

    other = short_link(client, "https://example.com/b")
    rules(client, other["id"], max_scans=2)
    assert [follow(client, other["slug"]).status_code for _ in range(3)] == [302, 302, 410]


def test_password_gate_cookie_and_blocked_scan_count(client, db):
    signup(client)
    link = short_link(client)
    assert rules(client, link["id"], password="cantina").status_code == 200
    gate = follow(client, link["slug"])
    assert gate.status_code == 200 and gate.headers["x-vorya-destination"] == "password"
    unlock = f"/api/public/links/{link['slug']}/unlock"
    assert client.post(unlock, json={"password": "sbagliata"}).json()["code"] == "wrong_password"
    ok = client.post(unlock, json={"password": "cantina"})
    assert ok.status_code == 200 and f"vqr_unlock_{link['id']}" in ok.headers["set-cookie"]
    assert follow(client, link["slug"]).headers["location"] == "https://example.com/a"
    outcomes = sorted(o for (o,) in db.query(ScanEvent.outcome).all())
    assert outcomes == ["ok", "password"]
    stats = client.get(f"{qrs(client)}/{link['id']}/stats").json()
    assert (stats["scans"], stats["blocked_scans"]) == (1, 1)
    # Changing the password revokes the cookie.
    rules(client, link["id"], password="nuova-password")
    assert follow(client, link["slug"]).headers["x-vorya-destination"] == "password"


def test_unlock_is_rate_limited(client):
    signup(client)
    link = short_link(client)
    rules(client, link["id"], password="cantina")
    unlock = f"/api/public/links/{link['slug']}/unlock"
    codes = [client.post(unlock, json={"password": "x"}).status_code for _ in range(11)]
    assert codes[-1] == 429


def test_password_protects_hosted_pages_too(client):
    signup(client)
    page = create_page_qr(client, "vcard", vcard_page()).json()
    rules(client, page["id"], password="segreto")
    client.cookies.clear()
    assert client.get(f"/api/public/pages/{page['slug']}").status_code == 403


def test_scheduled_destination_is_evaluated_at_redirect_time(client):
    signup(client)
    link = short_link(client)
    now = datetime.now(UTC)
    schedule = [
        {"starts_at": (now + timedelta(days=1)).isoformat(), "url": "https://example.com/futuro"},
        {"starts_at": (now - timedelta(hours=1)).isoformat(), "url": "https://example.com/ora"},
    ]
    saved = rules(client, link["id"], schedule=schedule).json()
    assert [e["url"] for e in saved["schedule"]] == ["https://example.com/ora",
                                                     "https://example.com/futuro"]  # fmt: skip
    assert follow(client, link["slug"]).headers["location"] == "https://example.com/ora"


def test_redirect_is_a_single_query_even_with_aliases(client):
    signup(client)
    link = short_link(client)
    add_alias(client, link["id"], "unico")
    statements = []

    def count(conn, cursor, statement, *args):
        if "FROM qr_codes" in statement:
            statements.append(statement)

    event.listen(get_engine(), "before_cursor_execute", count)
    try:
        assert follow(client, "unico").status_code == 302
    finally:
        event.remove(get_engine(), "before_cursor_execute", count)
    assert len(statements) == 1


def test_utm_templates_and_duplicate_parameters(client):
    signup(client)
    utm = qrs(client).replace("/qr-codes", "/utm-templates")
    body = {"name": "Newsletter", "source": "newsletter", "medium": "email"}
    assert client.post(utm, json=body, headers=csrf(client)).status_code == 201
    assert client.get(utm).json()[0]["source"] == "newsletter"
    dup = client.post(links(client), headers=csrf(client),
                      json={"target_url": "https://e.com/?utm_source=a&utm_source=b"})  # fmt: skip
    assert dup.status_code == 422
