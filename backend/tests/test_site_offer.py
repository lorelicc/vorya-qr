"""Commercial offer of the public site: editable from the admin, texts filled with the real trial."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import ORIGIN, csrf, login, make_admin, signup


@pytest.fixture
def admin():
    make_admin()
    with TestClient(app, base_url=ORIGIN) as c:
        assert login(c, "admin@example.com").status_code == 200
        yield c


def test_public_defaults_use_the_real_trial(client):
    offer = client.get("/api/public/site/offer").json()
    assert offer["featured_plan"] == "plus" and offer["featured_label"] == "Il più scelto"
    assert offer["yearly_discount_pct"] == 20 and offer["yearly_label"] == "Risparmi il 20%"
    assert offer["trial"] == {"days": 14, "plan_id": "pro", "plan_name": "Pro"}
    assert offer["banner"]["enabled"] and "Pro" in offer["banner"]["text"]
    assert "14" in offer["banner"]["text"] and "{" not in offer["banner"]["text"]


def test_admin_edits_offer_and_trial_then_the_site_and_signup_follow(admin, client):
    current = admin.get("/api/admin/site-offer").json()
    assert {p["id"] for p in current["plans"]} >= {"free", "start", "plus", "pro", "agency"}
    body = {
        **current["offer"],
        "featured_plan": "pro", "featured_label": "Consigliato", "yearly_discount_pct": 25,
        "trial_days": 7, "trial_plan_id": "plus",
        "banner": {"enabled": True, "text": "Prova {plan} per {days} giorni", "cta": "Vai",
                   "href": "/register", "tone": "indigo"},
    }  # fmt: skip
    saved = admin.put("/api/admin/site-offer", json=body, headers=csrf(admin))
    assert saved.status_code == 200, saved.text
    offer = client.get("/api/public/site/offer").json()
    assert offer["featured_plan"] == "pro" and offer["yearly_label"] == "Risparmi il 25%"
    assert (
        offer["banner"]["text"] == "Prova Plus per 7 giorni" and offer["banner"]["tone"] == "indigo"
    )
    signup(client, "nuovo@example.com")  # the same settings drive the real trial
    plan = client.get("/api/account/plan").json()["plan"]["id"]
    assert plan == "plus"


def test_validation_and_permissions(admin, client):
    base = admin.get("/api/admin/site-offer").json()["offer"]
    bad_href = {**base, "banner": {**base["banner"], "href": "javascript:alert(1)"}}
    assert admin.put("/api/admin/site-offer", json=bad_href, headers=csrf(admin)).status_code == 422
    bad_plan = {**base, "featured_plan": "inesistente"}
    assert admin.put("/api/admin/site-offer", json=bad_plan, headers=csrf(admin)).status_code == 422
    too_much = {**base, "yearly_discount_pct": 95}
    assert admin.put("/api/admin/site-offer", json=too_much, headers=csrf(admin)).status_code == 422
    assert client.get("/api/admin/site-offer").status_code in (401, 403)
    assert client.put("/api/admin/site-offer", json=base).status_code in (401, 403)
