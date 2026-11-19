from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.admin.clients import add_months
from app.billing import jobs
from app.billing.mail import send_pending
from app.core.security import now
from app.main import app
from app.models import BillingProfile, PlanGrant, Workspace
from tests.conftest import ORIGIN, csrf, login, make_admin, qrs, signup
from tests.test_billing import PROFILE, post_event, sub_obj


@pytest.fixture
def admin():
    make_admin()
    with TestClient(app, base_url=ORIGIN) as c:
        assert login(c, "admin@example.com").status_code == 200
        yield c


@pytest.fixture
def reader():
    make_admin("lettore@example.com", "platform_admin")
    with TestClient(app, base_url=ORIGIN) as c:
        assert login(c, "lettore@example.com").status_code == 200
        yield c


def grant(admin, client_id=1, **body):
    return admin.post(
        f"/api/admin/clients/{client_id}/grants",
        json={"plan_id": "pro", "months": 3, **body},
        headers=csrf(admin),
    )


def test_months_are_calendar_months():
    from datetime import UTC, datetime

    assert add_months(datetime(2026, 1, 31, tzinfo=UTC), 1) == datetime(2026, 2, 28, tzinfo=UTC)
    assert add_months(datetime(2026, 11, 15, tzinfo=UTC), 3) == datetime(2027, 2, 15, tzinfo=UTC)


def test_list_shows_customers_with_billing_data_and_filters(client, admin, db):
    signup(client)
    db.add(BillingProfile(workspace_id=1, **PROFILE | {"province": "MI"}))
    db.commit()
    rows = admin.get("/api/admin/clients").json()
    assert len(rows) == 1
    row = rows[0]
    assert row["owner"]["email"] == "cliente@example.com" and row["billing_state"] == "trialing"
    assert row["billing_complete"] and row["vat"] == "12345678903"
    assert row["companies"] == 1 and row["codes"] == 0
    assert admin.get("/api/admin/clients?search=12345678903").json()[0]["id"] == 1
    assert admin.get("/api/admin/clients?search=nessuno").json() == []
    assert admin.get("/api/admin/clients?state=gift").json() == []


def test_detail_shows_billing_subscription_and_linked_companies(client, admin, db):
    signup(client)
    client.post("/api/companies", json={"name": "Seconda"}, headers=csrf(client))
    detail = admin.get("/api/admin/clients/1").json()
    assert [c["name"] for c in detail["companies"]][-1] == "Seconda"
    assert detail["profile"] is None and detail["usage"]["companies"]["used"] == 2
    assert detail["owner"]["email"] == "cliente@example.com"
    assert admin.get("/api/admin/clients/99").status_code == 404


def test_only_admins_can_read_and_only_super_admins_write(client, admin, reader):
    signup(client)
    assert client.get("/api/admin/clients").status_code == 403
    assert reader.get("/api/admin/clients").status_code == 200
    assert grant(reader).status_code == 403
    assert grant(client).status_code == 403


def test_gift_unblocks_an_expired_account_then_ends_like_a_trial(client, admin, db):
    signup(client)
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(days=1)))
    db.commit()
    assert client.get(qrs(client)).status_code == 423
    done = grant(admin, plan_id="plus", months=2, note="Cliente storico")
    assert done.status_code == 201
    data = done.json()
    assert data["plan_id"] == "plus" and data["billing_state"] == "gift"
    assert data["trial_ends_at"] is None and data["grants"][0]["note"] == "Cliente storico"
    assert client.get(qrs(client)).status_code == 200
    assert client.get("/api/account/billing").json()["plan"]["id"] == "plus"
    assert admin.get("/api/admin/clients?state=gift").json()[0]["id"] == 1

    # The gift runs out: same rules as an ended trial.
    db.execute(update(Workspace).values(grant_until=now() - timedelta(minutes=1)))
    db.commit()
    assert client.get(qrs(client)).status_code == 423
    assert jobs.expire_grants(db) == 1
    db.commit()
    w = db.scalars(select(Workspace)).one()
    assert w.grant_until is None and w.trial_ends_at is not None
    assert client.get(qrs(client)).status_code == 423


def test_gifts_stack_and_the_customer_gets_one_email(client, admin, db):
    signup(client)
    first = grant(admin, months=3).json()["grant_until"]
    second = grant(admin, months=1).json()["grant_until"]
    assert second > first
    assert len(db.scalars(select(PlanGrant)).all()) == 2
    assert send_pending(db) == 2
    db.commit()
    from tests.test_billing import _all_mail

    mails = _all_mail()
    assert {m["subject"] for m in mails} == {"Hai ricevuto un piano in omaggio · Vorya QR"}
    texts = " ".join(m["text"] for m in mails)
    assert "3 mesi del piano Pro" in texts and "1 mese del piano Pro" in texts


def test_no_gift_over_a_paid_subscription(client, admin, db):
    signup(client)
    from tests.test_billing import seed_prices

    seed_prices(db)
    post_event(client, "e1", "customer.subscription.created", sub_obj())
    refused = grant(admin)
    assert refused.status_code == 409 and "abbonamento attivo" in refused.json()["detail"]


def test_revoking_a_gift_ends_it_now(client, admin, db):
    signup(client)
    made = grant(admin, plan_id="plus", months=6).json()
    gid = made["grants"][0]["id"]
    revoked = admin.post(f"/api/admin/clients/1/grants/{gid}/revoke", headers=csrf(admin))
    assert revoked.status_code == 200
    data = revoked.json()
    assert data["grant_until"] is None and data["grants"][0]["revoked_at"]
    assert client.get(qrs(client)).status_code == 423
    again = admin.post(f"/api/admin/clients/1/grants/{gid}/revoke", headers=csrf(admin))
    assert again.status_code == 409


def test_a_payment_during_a_gift_takes_over(client, admin, db):
    from tests.test_billing import seed_prices

    signup(client)
    seed_prices(db)
    grant(admin, months=6)
    post_event(client, "e1", "customer.subscription.created", sub_obj("price_plus_m"))
    db.expire_all()
    w = db.scalars(select(Workspace)).one()
    assert (w.plan_id, w.billing_state, w.grant_until) == ("plus", "active", None)


def test_unknown_plan_and_bad_months_are_rejected(client, admin):
    signup(client)
    assert grant(admin, plan_id="ghost").status_code == 404
    assert grant(admin, months=0).status_code == 422
    assert grant(admin, months=99).status_code == 422
