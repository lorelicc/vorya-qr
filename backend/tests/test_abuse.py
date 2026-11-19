import contextlib

import pytest
from sqlalchemy import select

from app.abuse import checks
from app.models import AbuseReport, QrCode, Workspace
from tests.conftest import csrf, login, make_admin, qrs, signup
from tests.test_pages_types import create_page_qr, vcard_page
from tests.test_qr import create
from tests.test_redirect import follow


class FakeProvider:
    def __init__(self, bad):
        self.bad, self.calls = set(bad), 0

    def flagged(self, urls):
        self.calls += 1
        return self.bad & set(urls)


@pytest.fixture(autouse=True)
def no_provider():
    checks.set_provider(None)
    yield
    checks.set_provider(None)


def as_admin(client):
    with contextlib.suppress(SystemExit):  # already created earlier in the same test
        make_admin()
    client.cookies.clear()
    login(client, "admin@example.com")


def restore(client, cookies):
    client.cookies.clear()
    for name, value in cookies.items():
        client.cookies.set(name, value)


def block(client, domain):
    return client.post("/api/admin/blocked-domains", json={"domain": domain}, headers=csrf(client))


def test_url_extraction_and_domain_matching():
    page = {"blocks": [{"url": "https://a.example.com/x"}, {"items": [{"url": "http://b.it"}]}],
            "text": "not a url"}  # fmt: skip
    assert checks.urls_in(["https://x.it", page, None]) == [
        "https://x.it", "https://a.example.com/x", "http://b.it"]  # fmt: skip
    assert checks.normalise_domain("https://WWW.Evil.com/path") == "evil.com"


def test_blocked_domain_refuses_create_update_and_pages(client):
    signup(client)
    owner = dict(client.cookies)
    qr = create(client).json()
    as_admin(client)
    assert block(client, "https://www.evil.example").status_code == 201
    assert block(client, "evil.example").status_code == 409
    assert block(client, "not a domain").status_code == 422
    restore(client, owner)
    bad = create(client, target_url="https://login.evil.example/x")
    assert bad.status_code == 422 and bad.json()["code"] == "blocked_domain"
    assert bad.json()["errors"][0]["field"] == "destination"
    put = client.put(f"{qrs(client)}/{qr['id']}", json={"target_url": "https://evil.example"},
                     headers=csrf(client))  # fmt: skip
    assert put.status_code == 422
    page = vcard_page(website="https://evil.example/me")
    assert create_page_qr(client, "vcard", page).json()["code"] == "blocked_domain"
    assert create(client, target_url="https://notevil.example").status_code == 201


def test_reputation_provider_blocks_flagged_urls_but_not_previews(client):
    fake = FakeProvider({"https://phish.test/login"})
    checks.set_provider(fake)
    signup(client)
    bad = create(client, target_url="https://phish.test/login")
    assert bad.status_code == 422 and bad.json()["code"] == "unsafe_url"
    calls = fake.calls
    body = {
        "qr_type": "website",
        "dynamic": False,
        "static_data": {"url": "https://phish.test/login"},
    }
    client.post(f"{qrs(client)}/preview", json=body, headers=csrf(client))
    assert fake.calls == calls  # previews never call the provider
    assert create(client, target_url="https://ok.test").status_code == 201


def test_no_api_key_skips_the_check(client):
    signup(client)
    assert isinstance(checks.provider(), checks.NoProvider)
    assert create(client, target_url="https://whatever.test").status_code == 201


def test_report_flow_block_and_suspend(client, db):
    signup(client)
    owner = dict(client.cookies)
    qr = create(client).json()
    client.cookies.clear()
    for link in (qr["short_url"], qr["slug"], "ZZZZZZZ"):
        body = {"link": link, "reason": "phishing", "details": "Chiede la password"}
        sent = client.post("/api/public/reports", json=body)
        assert sent.status_code == 202
    assert (
        client.post("/api/public/reports", json={"link": "boh", "reason": "spam"}).status_code
        == 422
    )
    assert db.scalar(select(AbuseReport).where(AbuseReport.slug == "ZZZZZZZ")).qr_code_id is None
    as_admin(client)
    listed = client.get("/api/admin/reports").json()
    assert listed["open"] == 3
    report = next(r for r in listed["items"] if r["qr"])
    done = client.post(f"/api/admin/reports/{report['id']}/resolve", json={"action": "block_qr"},
                       headers=csrf(client))  # fmt: skip
    assert done.status_code == 200, done.text
    assert done.json()["qr"]["status"] == "blocked"
    assert client.get("/api/admin/reports").json()["open"] == 1  # both reports on the QR closed
    assert follow(client, qr["slug"]).status_code == 410
    restore(client, owner)
    resumed = client.post(f"{qrs(client)}/{qr['id']}/resume", headers=csrf(client))
    assert resumed.status_code == 403 and resumed.json()["code"] == "qr_blocked"
    as_admin(client)
    assert (
        client.post(f"/api/admin/qr-codes/{qr['id']}/unblock", headers=csrf(client)).status_code
        == 200
    )
    assert follow(client, qr["slug"]).status_code == 302
    client.post("/api/public/reports", json={"link": qr["slug"], "reason": "malware"})
    report = client.get("/api/admin/reports").json()["items"][0]
    client.post(f"/api/admin/reports/{report['id']}/resolve",
                json={"action": "suspend_workspace"}, headers=csrf(client))  # fmt: skip
    db.expire_all()
    assert db.get(Workspace, db.get(QrCode, qr["id"]).workspace_id).status == "suspended"


def test_reports_are_rate_limited(client):
    for _ in range(5):
        client.post("/api/public/reports", json={"link": "Ab3dEf7", "reason": "spam"})
    late = client.post("/api/public/reports", json={"link": "Ab3dEf7", "reason": "spam"})
    assert late.status_code == 429


def test_only_admins_moderate(client):
    signup(client)
    assert client.get("/api/admin/reports").status_code == 403
    assert block(client, "evil.example").status_code == 403
