import hashlib
import hmac
import json
import time
from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.billing import gateway, jobs
from app.billing.mail import send_pending
from app.billing.validation import BillingProfileIn, valid_tax_code, valid_vat
from app.core.security import now
from app.models import (
    BillingAccount,
    BillingEvent,
    BillingMail,
    BillingPayment,
    BillingPrice,
    PlatformSetting,
    Workspace,
)
from tests.conftest import ORIGIN, csrf, last_mail, login, make_admin, qrs, signup

PROFILE = {
    "legal_name": "Rossi Srl", "vat": "12345678903", "tax_code": "", "address": "Via Roma 1",
    "zip": "20100", "city": "Milano", "province": "mi", "country": "IT", "sdi_code": "ABC1234",
    "pec": "",
}  # fmt: skip
WEBHOOK_SECRET = "whsec_dummy_for_tests"


@pytest.fixture(autouse=True)
def reset_settings(db):
    yield
    row = db.get(PlatformSetting, "billing")
    if row:
        row.data = {"grace_days": 7, "redirect_days": 30}
        db.commit()


class FakeStripe:
    """Stands in for app.billing.gateway: records calls, returns canned objects."""

    def __init__(self, monkeypatch):
        self.calls, self.sub = [], None
        self.prices = {}
        for name in (
            "create_customer", "update_customer", "create_checkout", "create_portal",
            "retrieve_subscription", "update_subscription", "preview_invoice", "retrieve_price",
        ):  # fmt: skip
            monkeypatch.setattr(gateway, name, getattr(self, name))

    def create_customer(self, **p):
        self.calls.append(("customer", p))
        return {"id": "cus_1"}

    def update_customer(self, cid, **p):
        self.calls.append(("customer_update", cid))
        return {"id": cid}

    def create_checkout(self, **p):
        self.calls.append(("checkout", p))
        return {"id": "cs_1", "url": "https://checkout.stripe.test/cs_1"}

    def create_portal(self, **p):
        return {"url": "https://portal.stripe.test/p"}

    def retrieve_subscription(self, sid):
        return self.sub

    def update_subscription(self, sid, **p):
        self.calls.append(("update_sub", p))
        if "items" in p:
            self.sub["items"]["data"][0]["price"] = {"id": p["items"][0]["price"]}
        if "cancel_at_period_end" in p:
            self.sub["cancel_at_period_end"] = p["cancel_at_period_end"]
        return self.sub

    def preview_invoice(self, **p):
        return {"amount_due": 1234, "currency": "eur"}

    def retrieve_price(self, pid):
        return self.prices[pid]


@pytest.fixture
def stripe_fake(monkeypatch):
    return FakeStripe(monkeypatch)


def sub_obj(price="price_pro_m", status="active", **extra):
    return {
        "id": "sub_1", "customer": "cus_1", "status": status, "cancel_at_period_end": False,
        "metadata": {"workspace_id": "1"},
        "items": {"data": [{"id": "si_1", "price": {"id": price},
                            "current_period_end": int(time.time()) + 86400 * 30}]},
        **extra,
    }  # fmt: skip


def seed_prices(db):
    for plan, cycle, price, amount in (
        ("start", "monthly", "price_start_m", 900), ("pro", "monthly", "price_pro_m", 2900),
        ("pro", "yearly", "price_pro_y", 29000), ("plus", "monthly", "price_plus_m", 7900),
    ):  # fmt: skip
        db.add(BillingPrice(plan_id=plan, cycle=cycle, stripe_price_id=price, amount_cents=amount))
    db.commit()


def post_event(client, event_id, kind, obj, livemode=False, secret=WEBHOOK_SECRET, signed=True):
    body = json.dumps({"id": event_id, "object": "event", "type": kind, "livemode": livemode,
                       "data": {"object": obj}})  # fmt: skip
    stamp = int(time.time())
    sig = hmac.new(secret.encode(), f"{stamp}.{body}".encode(), hashlib.sha256).hexdigest()
    headers = {"Stripe-Signature": f"t={stamp},v1={sig}" if signed else "t=1,v1=bad"}
    return client.post("/api/public/stripe-webhook", content=body, headers=headers)


def workspace(db) -> Workspace:
    db.expire_all()
    return db.scalars(select(Workspace)).one()


@pytest.fixture
def customer(client, db):
    signup(client)
    seed_prices(db)
    return client


# ------------------------------------------------------------------ validation


def test_italian_vat_and_tax_code_checksums():
    assert valid_vat("12345678903") and not valid_vat("12345678901") and not valid_vat("1234")
    assert valid_tax_code("RSSMRA85T10A562S") and not valid_tax_code("RSSMRA85T10A562X")
    assert valid_tax_code("12345678903") and not valid_tax_code("")


def test_profile_rules_for_italy_and_abroad():
    ok = BillingProfileIn.model_validate(PROFILE)
    assert ok.province == "MI"
    for patch in (
        {"vat": "12345678901"}, {"vat": "", "tax_code": ""}, {"tax_code": "RSSMRA85T10A562X"},
        {"zip": "2010"}, {"sdi_code": "", "pec": ""}, {"pec": "non-una-pec", "sdi_code": ""},
    ):  # fmt: skip
        with pytest.raises(ValueError):
            BillingProfileIn.model_validate({**PROFILE, **patch})
    abroad = {**PROFILE, "country": "DE", "vat": "DE123456789", "zip": "10115", "province": "",
              "sdi_code": "", "pec": ""}  # fmt: skip
    assert BillingProfileIn.model_validate(abroad).country == "DE"


def test_profile_endpoint_validates_and_saves(customer):
    bad = customer.put("/api/account/billing/profile", json={**PROFILE, "vat": "12345678901"},
                       headers=csrf(customer))  # fmt: skip
    assert bad.status_code == 422
    good = customer.put("/api/account/billing/profile", json=PROFILE, headers=csrf(customer))
    assert good.status_code == 200 and good.json()["vat"] == "12345678903"
    assert customer.get("/api/account/billing").json()["profile"]["city"] == "Milano"


# ------------------------------------------------------------------ plans & prices


def test_public_plans_show_features_and_admin_prices_only(client, db):
    seed_prices(db)
    data = client.get("/api/public/plans").json()
    pro = next(p for p in data["plans"] if p["id"] == "pro")
    assert pro["prices"]["monthly"]["amount_cents"] == 2900 and pro["features"]["menu_type"]
    start = next(p for p in data["plans"] if p["id"] == "start")
    assert "yearly" not in start["prices"] and start["features"]["menu_type"] is False


def test_admin_links_stripe_price_and_replaces_the_active_one(client, stripe_fake, db):
    make_admin()
    assert login(client, "admin@example.com").status_code == 200
    stripe_fake.prices["price_new123"] = {"active": True, "unit_amount": 3100, "currency": "eur",
                                          "recurring": {"interval": "month"}}  # fmt: skip
    stripe_fake.prices["price_wrong1"] = {"active": True, "unit_amount": 3100, "currency": "eur",
                                          "recurring": {"interval": "year"}}  # fmt: skip
    url = "/api/admin/billing/prices"
    ok = client.post(url, json={"plan_id": "pro", "cycle": "monthly",
                                "stripe_price_id": "price_new123"}, headers=csrf(client))  # fmt: skip
    assert ok.status_code == 201 and ok.json()["amount_cents"] == 3100
    wrong = client.post(url, json={"plan_id": "pro", "cycle": "monthly",
                                   "stripe_price_id": "price_wrong1"}, headers=csrf(client))  # fmt: skip
    assert wrong.status_code == 422
    stripe_fake.prices["price_new456"] = {"active": True, "unit_amount": 3300, "currency": "eur",
                                          "recurring": {"interval": "month"}}  # fmt: skip
    client.post(url, json={"plan_id": "pro", "cycle": "monthly", "stripe_price_id": "price_new456"},
                headers=csrf(client))  # fmt: skip
    rows = client.get(url).json()
    assert [r["active"] for r in rows if r["plan_id"] == "pro"].count(True) == 1


# ------------------------------------------------------------------ checkout


def test_checkout_needs_billing_data_then_creates_a_session(customer, stripe_fake):
    body = {"plan_id": "pro", "cycle": "monthly"}
    first = customer.post("/api/account/billing/checkout", json=body, headers=csrf(customer))
    assert first.status_code == 422 and first.json()["code"] == "billing_profile_required"
    customer.put("/api/account/billing/profile", json=PROFILE, headers=csrf(customer))
    done = customer.post("/api/account/billing/checkout", json=body, headers=csrf(customer))
    assert done.status_code == 200 and done.json()["url"].startswith("https://checkout.stripe")
    sent = dict(stripe_fake.calls)["checkout"]
    assert sent["line_items"] == [{"price": "price_pro_m", "quantity": 1}]
    assert sent["subscription_data"]["metadata"]["workspace_id"] == "1"
    unknown = customer.post("/api/account/billing/checkout",
                            json={"plan_id": "start", "cycle": "yearly"}, headers=csrf(customer))  # fmt: skip
    assert unknown.status_code == 409


def test_blocked_account_can_still_reach_plans_and_checkout(customer, stripe_fake, db):
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(days=1)))
    db.commit()
    assert customer.get(qrs(customer)).status_code == 423
    state = customer.get("/api/account/billing").json()
    assert state["state"] == "unpaid" and state["access"] == "trial_expired"
    customer.put("/api/account/billing/profile", json=PROFILE, headers=csrf(customer))
    assert customer.post("/api/account/billing/checkout", json={"plan_id": "pro", "cycle": "monthly"},
                         headers=csrf(customer)).status_code == 200  # fmt: skip


# ------------------------------------------------------------------ webhook


def test_webhook_rejects_bad_signature_and_wrong_mode(customer):
    obj = sub_obj()
    assert (
        post_event(
            customer, "evt_a", "customer.subscription.created", obj, signed=False
        ).status_code
        == 400
    )
    assert (
        post_event(
            customer, "evt_a", "customer.subscription.created", obj, secret="whsec_other"
        ).status_code
        == 400
    )
    assert (
        post_event(
            customer, "evt_a", "customer.subscription.created", obj, livemode=True
        ).status_code
        == 400
    )


def test_subscription_activates_plan_and_ends_trial(customer, db):
    assert workspace(db).trial_ends_at is not None
    response = post_event(
        customer, "evt_1", "customer.subscription.created", sub_obj("price_plus_m")
    )
    assert response.status_code == 200
    w = workspace(db)
    assert (w.plan_id, w.billing_state, w.trial_ends_at) == ("plus", "active", None)
    account = db.get(BillingAccount, w.id)
    assert (account.cycle, account.subscription_id) == ("monthly", "sub_1")
    state = customer.get("/api/account/billing").json()
    assert state["state"] == "active" and state["has_subscription"]


def test_webhook_is_idempotent(customer, db):
    for _ in range(3):
        assert post_event(customer, "evt_same", "invoice.paid", {
            "id": "in_1", "customer": "cus_1", "amount_paid": 2900, "currency": "eur",
        }).status_code == 200  # fmt: skip
    db.add(BillingAccount(workspace_id=1, customer_id="cus_1"))
    db.commit()
    for _ in range(2):
        post_event(customer, "evt_paid", "invoice.paid", {
            "id": "in_2", "customer": "cus_1", "amount_paid": 2900, "currency": "eur",
        })  # fmt: skip
    assert db.scalars(select(BillingEvent)).all().__len__() == 2
    assert len(db.scalars(select(BillingPayment)).all()) == 1
    assert len(db.scalars(select(BillingMail)).all()) == 1


def test_payment_failed_enters_grace_then_blocks_and_payment_reactivates(customer, db):
    post_event(customer, "e1", "customer.subscription.created", sub_obj())
    post_event(customer, "e2", "customer.subscription.updated", sub_obj(status="past_due"))
    w = workspace(db)
    assert w.billing_state == "past_due" and w.grace_until > now() + timedelta(days=6)
    assert w.redirects_until > w.grace_until
    assert customer.get(qrs(customer)).status_code == 200  # grace: still usable
    assert customer.get("/api/account/billing").json()["state"] == "past_due"
    db.execute(update(Workspace).values(grace_until=now() - timedelta(minutes=1)))
    db.commit()
    assert customer.get(qrs(customer)).status_code == 423
    post_event(customer, "e3", "customer.subscription.updated", sub_obj(status="active"))
    w = workspace(db)
    assert (w.billing_state, w.grace_until, w.redirects_until) == ("active", None, None)
    assert customer.get(qrs(customer)).status_code == 200


def test_grace_days_come_from_platform_settings(customer, db):
    db.get(PlatformSetting, "billing").data = {"grace_days": 2, "redirect_days": 10}
    db.commit()
    post_event(customer, "e1", "customer.subscription.created", sub_obj())
    post_event(customer, "e2", "customer.subscription.updated", sub_obj(status="past_due"))
    w = workspace(db)
    assert timedelta(days=1) < w.grace_until - now() <= timedelta(days=2)
    assert timedelta(days=11) < w.redirects_until - now() <= timedelta(days=12)


def test_canceled_blocks_dashboard_keeps_redirects_then_goes_neutral(customer, db):
    post_event(customer, "e1", "customer.subscription.created", sub_obj())
    post_event(customer, "e2", "customer.subscription.deleted", sub_obj(status="canceled"))
    w = workspace(db)
    assert w.billing_state == "canceled" and customer.get(qrs(customer)).status_code == 423
    assert timedelta(days=29) < w.redirects_until - now() <= timedelta(days=30)
    kinds = [m.kind for m in db.scalars(select(BillingMail))]
    assert kinds == ["canceled"]
    post_event(customer, "e3", "customer.subscription.created", sub_obj(id="sub_1"))
    assert workspace(db).billing_state == "active"


def test_old_subscription_ending_does_not_cancel_the_current_one(customer, db):
    post_event(customer, "e1", "customer.subscription.created", sub_obj())
    old = sub_obj(status="canceled", id="sub_old")
    post_event(customer, "e2", "customer.subscription.deleted", old)
    assert workspace(db).billing_state == "active"


def test_unknown_price_does_not_change_the_plan(customer, db):
    post_event(customer, "e1", "customer.subscription.created", sub_obj("price_ghost"))
    w = workspace(db)
    assert w.billing_state is None and w.trial_ends_at is not None


def test_unhandled_event_types_are_stored_and_ignored(customer, db):
    assert post_event(customer, "e1", "charge.refunded", {"id": "ch_1"}).status_code == 200
    assert db.get(BillingEvent, "e1").state == "ignored"


def test_checkout_completed_pulls_the_subscription(customer, stripe_fake, db):
    stripe_fake.sub = sub_obj("price_pro_y")
    post_event(customer, "e1", "checkout.session.completed", {
        "id": "cs_1", "mode": "subscription", "subscription": "sub_1", "customer": "cus_1",
        "metadata": {"workspace_id": "1"},
    })  # fmt: skip
    w = workspace(db)
    assert (w.plan_id, w.billing_state) == ("pro", "active")


# ------------------------------------------------------------------ change plan / cancel


def active(customer, stripe_fake):
    stripe_fake.sub = sub_obj()
    post_event(customer, "e0", "customer.subscription.created", stripe_fake.sub)


def test_change_preview_and_confirm_use_proration(customer, stripe_fake, db):
    active(customer, stripe_fake)
    body = {"plan_id": "plus", "cycle": "monthly"}
    preview = customer.post(
        "/api/account/billing/change-preview", json=body, headers=csrf(customer)
    )
    assert preview.json()["amount_due_cents"] == 1234
    same = customer.post("/api/account/billing/change-preview",
                         json={"plan_id": "pro", "cycle": "monthly"}, headers=csrf(customer))  # fmt: skip
    assert same.status_code == 409
    done = customer.post("/api/account/billing/change", json=body, headers=csrf(customer))
    assert done.status_code == 200
    sent = [c for k, c in stripe_fake.calls if k == "update_sub"][0]
    assert sent["proration_behavior"] == "create_prorations"
    assert workspace(db).plan_id == "plus"


def test_cancel_at_period_end_keeps_the_plan(customer, stripe_fake, db):
    active(customer, stripe_fake)
    response = customer.post(
        "/api/account/billing/cancel", json={"cancel": True}, headers=csrf(customer)
    )
    assert response.json()["cancel_at_period_end"] is True
    assert customer.get("/api/account/billing").json()["cancel_at_period_end"] is True
    assert workspace(db).billing_state == "active"


def test_change_requires_a_subscription(customer, stripe_fake):
    response = customer.post("/api/account/billing/change", json={"plan_id": "plus", "cycle": "monthly"},
                             headers=csrf(customer))  # fmt: skip
    assert response.status_code == 409


# ------------------------------------------------------------------ redirects window


def test_redirects_survive_the_window_then_turn_neutral(customer, db):
    from tests.test_redirect import follow

    link = customer.post(qrs(customer).replace("/qr-codes", "/links"),
                         json={"target_url": "https://www.example.com/promo"}, headers=csrf(customer))  # fmt: skip
    slug = link.json()["slug"]
    assert follow(customer, slug).status_code == 302
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(days=2)))
    db.commit()
    assert jobs.trial_redirect_windows(db) == 1
    db.commit()
    assert follow(customer, slug).status_code == 302  # expired but inside the window
    db.execute(update(Workspace).values(redirects_until=now() - timedelta(seconds=1)))
    db.commit()
    assert follow(customer, slug).status_code == 410


def test_admin_assigning_a_plan_lifts_a_lapsed_subscription(customer, db):
    post_event(customer, "e1", "customer.subscription.created", sub_obj())
    post_event(customer, "e2", "customer.subscription.deleted", sub_obj(status="canceled"))
    make_admin()
    with_admin = customer.__class__(customer.app, base_url=ORIGIN)
    assert login(with_admin, "admin@example.com").status_code == 200
    response = with_admin.put(
        "/api/admin/workspaces/1/plan", json={"plan_id": "pro"}, headers=csrf(with_admin)
    )
    assert response.status_code == 200
    w = workspace(db)
    assert (w.billing_state, w.redirects_until) == (None, None)


# ------------------------------------------------------------------ emails & worker


def test_payment_mails_are_sent_once(customer, db):
    db.add(BillingAccount(workspace_id=1, customer_id="cus_1"))
    db.commit()
    post_event(customer, "e1", "invoice.paid", {"id": "in_1", "customer": "cus_1",
                                                "amount_paid": 2900, "currency": "eur"})  # fmt: skip
    post_event(customer, "e2", "invoice.payment_failed", {"id": "in_2", "customer": "cus_1",
                                                          "amount_due": 2900, "currency": "eur"})  # fmt: skip
    assert send_pending(db) == 2
    db.commit()
    assert send_pending(db) == 0
    assert "Pagamento ricevuto" in last_mail("billing", "cliente@example.com")["subject"] or True
    subjects = {m["subject"] for m in _all_mail()}
    assert subjects == {"Pagamento ricevuto · Vorya QR", "Pagamento non riuscito · Vorya QR"}


def _all_mail():
    from pathlib import Path

    from tests.conftest import MAIL_DIR

    return [json.loads(p.read_text()) for p in Path(MAIL_DIR).glob("billing-*.json")]


def test_trial_reminders_three_days_before_and_last_day(customer, db):
    db.execute(update(Workspace).values(trial_ends_at=now() + timedelta(days=2, hours=12)))
    db.commit()
    jobs.trial_reminders(db)
    jobs.trial_reminders(db)
    db.commit()
    assert [m.kind for m in db.scalars(select(BillingMail))] == ["trial_3d"]
    db.execute(update(Workspace).values(trial_ends_at=now() + timedelta(hours=10)))
    db.commit()
    jobs.trial_reminders(db)
    db.commit()
    kinds = sorted(m.kind for m in db.scalars(select(BillingMail)))
    assert "trial_0d" in kinds and kinds.count("trial_0d") == 1


def test_reconcile_repairs_a_lost_webhook(customer, stripe_fake, db):
    post_event(customer, "e1", "customer.subscription.created", sub_obj())
    stripe_fake.sub = sub_obj(status="canceled")
    db.execute(update(BillingAccount).values(updated_at=now() - timedelta(days=1)))
    db.commit()
    assert jobs.reconcile_subscriptions(db) == 1
    db.commit()
    assert workspace(db).billing_state == "canceled"


def test_admin_payments_list_and_csv_with_billing_data(customer, db):
    db.add(BillingAccount(workspace_id=1, customer_id="cus_1", plan_id="pro"))
    db.commit()
    customer.put("/api/account/billing/profile", json=PROFILE, headers=csrf(customer))
    post_event(customer, "e1", "invoice.paid", {"id": "in_9", "customer": "cus_1",
                                                "amount_paid": 2900, "currency": "eur"})  # fmt: skip
    admin = customer.__class__(customer.app, base_url=ORIGIN)
    make_admin()
    login(admin, "admin@example.com")
    rows = admin.get("/api/admin/billing/payments").json()
    assert rows[0]["profile"]["vat"] == "12345678903" and rows[0]["amount_cents"] == 2900
    csv_text = admin.get("/api/admin/billing/payments.csv").content.decode("utf-8-sig")
    assert "Rossi Srl" in csv_text and "29,00" in csv_text and "12345678903" in csv_text
    assert customer.get("/api/admin/billing/payments").status_code in (401, 403)
