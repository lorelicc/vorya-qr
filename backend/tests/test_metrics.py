"""Admin metrics: computed into snapshots, with the definitions of the docs."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import update

from app.core.security import now
from app.main import app
from app.metrics import as_csv, compute, snapshot
from app.models import BillingAccount, Workspace
from app.worker import compute_metrics
from tests.conftest import ORIGIN, login, make_admin, qrs, signup
from tests.test_billing import post_event, seed_prices, sub_obj
from tests.test_qr import create


def admin_client():
    make_admin()
    c = TestClient(app, base_url=ORIGIN)
    c.__enter__()
    assert login(c, "admin@example.com").status_code == 200
    return c


def test_signups_activation_trials_and_distribution(client, db):
    signup(client)
    create(client)
    data = compute(db)
    assert data["signups"]["day"] == 1 and data["signups"]["total"] == 1
    assert data["trials_active"] == 1 and data["plans"] == {"pro": 1}
    # activation looks at workspaces 7-37 days old: age this one and check the 7-day rule
    db.execute(update(Workspace).values(created_at=now() - timedelta(days=10)))
    db.commit()
    from app.models import QrCode

    db.execute(update(QrCode).values(created_at=now() - timedelta(days=9)))
    db.commit()
    data = compute(db)
    assert data["activation"] == {"cohort": 1, "activated": 1, "percent": 100.0}


def test_mrr_arr_arpa_churn_and_conversion_from_real_prices(client, db):
    signup(client)
    seed_prices(db)
    post_event(client, "e1", "customer.subscription.created", sub_obj("price_pro_m"))
    data = compute(db)
    assert data["revenue"] == {
        "mrr_cents": 2900,
        "arr_cents": 34800,
        "payers": 1,
        "arpa_cents": 2900,
    }
    assert data["plans"] == {"pro": 1} and data["churn"]["percent"] == 0.0
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(days=5)))
    db.commit()
    assert compute(db)["conversion"] == {"ended": 1, "paying": 1, "percent": 100.0}
    post_event(
        client, "e2", "customer.subscription.deleted", sub_obj("price_pro_m", status="canceled")
    )
    after = compute(db)
    assert after["revenue"]["mrr_cents"] == 0 and after["churn"]["cancelled_30d"] == 1
    assert after["plans"] == {"free": 1}  # cancelled = Free


def test_plan_changes_are_counted_as_upgrades_and_downgrades(client, db):
    signup(client)
    seed_prices(db)
    post_event(client, "e1", "customer.subscription.created", sub_obj("price_pro_m"))
    post_event(
        client, "e2", "customer.subscription.updated", sub_obj("price_plus_m")
    )  # pro -> plus
    post_event(client, "e3", "customer.subscription.updated", sub_obj("price_start_m"))
    changes = compute(db)["plan_changes_30d"]
    assert changes == {
        "upgrades": 0,
        "downgrades": 2,
    }  # pro -> plus is a step down, plus -> start too


def test_funnel_by_source_and_generator_counters(client, db):
    from tests.test_generator import SITE, URL, register_with

    client.post(f"{URL}/track", json={"event": "view", "type": "website", "landing": "/genera"})
    client.post(f"{URL}/download", json={**SITE, "format": "svg", "landing": "/genera"})
    register_with(client, "f@example.com", attribution={"utm_source": "google", "landing": "/genera", "generator": "website"},
                  handoff={"type": "website", "data": {"url": "https://example.com/a"}})  # fmt: skip
    data = compute(db)
    assert data["funnel"]["generator"]["download"] == 1 and data["funnel"]["generator"]["view"] == 1
    source = data["funnel"]["sources"]["generatore gratuito"]
    assert source == {"signups": 1, "activated": 1, "paying": 0}  # the handoff made a dynamic QR
    assert data["funnel"]["landings"]["/genera"] == {"view": 1, "download": 1, "signups": 1}


def test_worker_snapshot_once_an_hour_endpoint_and_csv(client, db):
    signup(client)
    assert compute_metrics(db) == 1
    db.commit()
    assert compute_metrics(db) == 0  # not recomputed within the hour
    admin = admin_client()
    data = admin.get("/api/admin/metrics").json()
    assert data["signups"]["total"] == 1 and "revenue" in data
    csv_text = admin.get("/api/admin/metrics/export.csv").content.decode("utf-8-sig")
    assert "Iscritti totali;1" in csv_text and "MRR €" in csv_text
    assert client.get("/api/admin/metrics").status_code in (401, 403)
    assert as_csv(snapshot(db).data).startswith("﻿")
    _ = (BillingAccount, qrs)
