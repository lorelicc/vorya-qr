"""The Free plan: only the dynamic codes that fit it keep answering; the rest are suspended."""

from datetime import timedelta

from alembic import command
from sqlalchemy import select, text, update

from app.core.database import get_engine
from app.core.security import now
from app.models import Plan, ScanEvent, Workspace
from app.plans import effective_plan_id
from app.worker import stats_retention
from tests.conftest import csrf, qrs, signup
from tests.test_billing import post_event, seed_prices, sub_obj
from tests.test_migration_v01 import alembic
from tests.test_qr import create
from tests.test_redirect import follow
from tests.test_versions import update_qr


def on_free(db, **extra):
    db.execute(update(Workspace).values(plan_id="free", trial_ends_at=None, **extra))
    db.commit()


def plan_id(client) -> str:
    return client.get("/api/account/plan").json()["plan"]["id"]


def test_the_five_plans_and_their_limits(db):
    rows = {p.id: p for p in db.scalars(select(Plan))}
    assert list(rows) and set(rows) >= {"free", "start", "plus", "pro", "agency"}
    got = {i: (rows[i].max_companies, rows[i].max_dynamic_qr, rows[i].max_qr_static) for i in rows}
    assert got["free"] == (1, 2, 10)
    assert got["start"] == (1, 10, None)
    assert got["plus"] == (3, 25, None)
    assert got["pro"] == (10, 35, None)
    assert got["agency"] == (None, None, None)
    assert rows["free"].features["remove_branding"] is False  # never ads, branding stays on Free
    assert rows["agency"].features["stats_retention_days"] is None


def test_trial_ending_lands_on_free_and_only_the_free_codes_stay_active(client, db):
    signup(client)
    qrs_ = [create(client).json() for _ in range(4)]
    assert plan_id(client) == "pro"  # the trial gives Pro
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(minutes=1)))
    db.commit()
    assert plan_id(client) == "free"
    assert [follow(client, q["slug"]).status_code for q in qrs_] == [302, 302, 410, 410]
    assert client.get(qrs(client)).status_code == 200  # the dashboard is never blocked


def test_above_the_limit_is_suspended_and_read_only(client, db):
    signup(client)
    items = [create(client).json() for _ in range(4)]
    on_free(db)  # Free: 2 dynamic per company
    listed = {q["id"]: q for q in client.get(qrs(client)).json()}
    assert [listed[i["id"]]["locked"] for i in items] == [False, False, True, True]
    assert (
        update_qr(
            client, items[0]["id"], name="Rinominato", target_url="https://example.com/nuovo"
        ).status_code
        == 200
    )
    locked = update_qr(client, items[3]["id"], name="No", target_url="https://example.com/nuovo")
    assert locked.status_code == 403 and locked.json()["code"] == "read_only_over_limit"
    assert follow(client, items[3]["slug"]).status_code == 410  # suspended: "QR non attivo"
    assert follow(client, items[0]["slug"]).status_code == 302  # the Free ones keep working
    detail = client.get(f"{qrs(client)}/{items[3]['id']}").json()
    assert detail["locked"] and detail["locked_reason"] == "quota"
    # Pausing and deleting stay possible: the user is always in control.
    assert (
        client.post(f"{qrs(client)}/{items[3]['id']}/pause", headers=csrf(client)).status_code
        == 200
    )
    # Deleting one fitting code makes room: the oldest suspended one is reactivated.
    client.delete(f"{qrs(client)}/{items[0]['id']}", headers=csrf(client))
    assert follow(client, items[2]["slug"]).status_code == 302
    assert (
        update_qr(
            client, items[2]["id"], name="Ora sì", target_url="https://example.com/nuovo"
        ).status_code
        == 200
    )


def test_upgrade_unlocks_at_once(client, db, stripe_fake=None):
    signup(client)
    items = [create(client).json() for _ in range(4)]
    on_free(db)
    seed_prices(db)
    assert (
        update_qr(
            client, items[3]["id"], name="No", target_url="https://example.com/nuovo"
        ).status_code
        == 403
    )
    assert follow(client, items[3]["slug"]).status_code == 410
    post_event(client, "e1", "customer.subscription.created", sub_obj("price_start_m"))
    assert plan_id(client) == "start"  # 10 dynamic per company
    assert follow(client, items[3]["slug"]).status_code == 302  # reactivated at once
    assert (
        update_qr(
            client, items[3]["id"], name="Sì", target_url="https://example.com/nuovo"
        ).status_code
        == 200
    )


def test_paid_then_cancelled_goes_to_free_then_back(client, db):
    signup(client)
    seed_prices(db)
    post_event(client, "e1", "customer.subscription.created", sub_obj("price_plus_m"))
    assert plan_id(client) == "plus"
    post_event(
        client, "e2", "customer.subscription.deleted", sub_obj("price_plus_m", status="canceled")
    )
    assert plan_id(client) == "free" and client.get(qrs(client)).status_code == 200
    post_event(client, "e3", "customer.subscription.created", sub_obj("price_plus_m"))
    assert plan_id(client) == "plus"


def test_past_due_keeps_the_plan_during_grace_then_free(client, db):
    signup(client)
    seed_prices(db)
    post_event(client, "e1", "customer.subscription.created", sub_obj("price_pro_m"))
    post_event(
        client, "e2", "customer.subscription.updated", sub_obj("price_pro_m", status="past_due")
    )
    assert plan_id(client) == "pro"
    db.execute(update(Workspace).values(grace_until=now() - timedelta(seconds=1)))
    db.commit()
    assert plan_id(client) == "free"
    post_event(
        client, "e3", "customer.subscription.updated", sub_obj("price_pro_m", status="active")
    )
    assert plan_id(client) == "pro"


def test_effective_plan_function_covers_every_state(db):
    w = Workspace(
        plan_id="pro", billing_state=None, trial_ends_at=None, grant_until=None, grace_until=None
    )
    at = now()
    assert effective_plan_id(w, at) == "pro"  # assigned by an admin
    w.trial_ends_at = at + timedelta(days=1)
    assert effective_plan_id(w, at) == "pro"
    w.trial_ends_at = at - timedelta(days=1)
    assert effective_plan_id(w, at) == "free"
    w.grant_until = at + timedelta(days=5)
    assert effective_plan_id(w, at) == "pro"
    w.grant_until = at - timedelta(days=5)
    assert effective_plan_id(w, at) == "free"
    w.grant_until = None
    for state, expected in (("active", "pro"), ("canceled", "free"), ("unpaid", "free")):
        w.billing_state = state
        assert effective_plan_id(w, at) == expected
    w.billing_state, w.grace_until = "past_due", at + timedelta(days=1)
    assert effective_plan_id(w, at) == "pro"


def test_a_hosted_page_of_a_type_not_in_free_is_locked_but_still_served(client, db):
    from tests.test_pages_types import create_page_qr, vcard_page

    signup(client)
    pdf_like = create_page_qr(client, "link_in_bio", {"template": "link_in_bio", "blocks": [
        {"id": "l", "type": "link_list", "items": [{"label": "Sito", "url": "https://example.com"}]}]})  # fmt: skip
    from tests.test_menu import MENU

    menu = create_page_qr(client, "menu", MENU).json()
    on_free(db)
    assert pdf_like.status_code == 201
    editing = update_qr(client, menu["id"], name="x", target_url="https://example.com/nuovo")
    assert editing.status_code == 403 and editing.json()["code"] == "read_only_over_limit"
    assert client.get(f"/api/public/pages/{menu['slug']}").status_code == 200  # still served
    assert follow(client, menu["slug"]).status_code == 200
    _ = vcard_page


def test_stats_beyond_the_plan_window_are_kept_for_twelve_months(client, db):
    signup(client)
    qr = create(client).json()
    follow(client, qr["slug"])
    db.execute(update(ScanEvent).values(scanned_at=now() - timedelta(days=100)))
    on_free(db)  # Free shows 30 days
    assert stats_retention(db) == 0  # hidden, not deleted
    db.commit()
    assert db.scalar(text("SELECT count(*) FROM scan_events")) == 1


def test_static_codes_and_the_second_company_on_free(client, db):
    signup(client)
    static = create(client, kind="static").json()
    first = create(client).json()
    second_company = client.post("/api/companies", json={"name": "Seconda"}, headers=csrf(client))
    assert second_company.status_code == 201
    other = client.get("/api/companies").json()
    other_id = [c["id"] for c in other if c["name"] == "Seconda"][0]
    in_second = client.post(
        f"/api/companies/{other_id}/qr-codes",
        json={"name": "Altra", "qr_type": "website", "dynamic": True,
              "target_url": "https://example.com/altra"},
        headers=csrf(client),
    ).json()  # fmt: skip
    on_free(db)
    assert follow(client, first["slug"]).status_code == 302
    assert follow(client, in_second["slug"]).status_code == 410  # company above the Free limit
    assert static["kind"] == "static" and "slug" not in static or static.get("slug") is None


def test_a_suspended_hosted_page_is_not_served(client, db):
    from tests.test_pages_types import create_page_qr

    signup(client)
    page = create_page_qr(client, "link_in_bio", {"template": "link_in_bio", "blocks": [
        {"id": "l", "type": "link_list", "items": [{"label": "Sito", "url": "https://example.com"}]}]}).json()  # fmt: skip
    for _ in range(2):
        create(client)
    on_free(db)  # the page is the oldest: it fits; push it out by deleting nothing, add a newer one
    assert client.get(f"/api/public/pages/{page['slug']}").status_code == 200
    db.execute(update(Workspace).values(plan_id="free"))
    from app.models import QrCode

    db.execute(
        update(QrCode).where(QrCode.id == page["id"]).values(created_at=now() + timedelta(days=1))
    )
    db.commit()
    assert client.get(f"/api/public/pages/{page['slug']}").status_code == 404
    assert follow(client, page["slug"]).status_code == 410


def test_suspension_is_still_the_only_switch_off(client, db):
    signup(client)
    qr = create(client).json()
    db.execute(update(Workspace).values(status="suspended"))
    db.commit()
    assert follow(client, qr["slug"]).status_code == 410


def test_migration_swaps_pro_and_plus_together_with_their_references(monkeypatch, client, db):
    """Old pro (3 companies) becomes plus, old plus (10 companies) becomes pro, with prices."""
    signup(client)
    seed_prices(db)
    cfg = alembic(monkeypatch)
    command.downgrade(cfg, "0014_grants")  # data-only step: rows stay, the next upgrade re-runs
    db.execute(update(Workspace).values(plan_id="pro", trial_ends_at=None))  # an old "pro"
    db.commit()
    db.close()
    command.upgrade(cfg, "head")
    with get_engine().connect() as c:
        moved = c.execute(text("SELECT plan_id FROM workspaces")).scalar_one()
        prices = sorted(c.execute(text("SELECT DISTINCT plan_id FROM billing_prices")).scalars())
    assert moved == "plus"  # the 3-company plan keeps its customers, now named Plus
    assert "pro" in prices and "start" in prices  # price links followed their plans
