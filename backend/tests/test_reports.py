"""Email reports for a company's customers: plan gating, double opt-in, unsubscribe, scheduling."""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select, update

from app.core.security import now
from app.models import ReportLog, ReportRecipient, ScanEvent, Workspace
from app.reports.service import ROME, label, period_for, schedule, send_due
from tests.conftest import MAIL_DIR, csrf, signup
from tests.test_qr import create
from tests.test_redirect import follow


def base(client):
    cid = client.get("/api/auth/me").json()["last_company_id"]
    return f"/api/companies/{cid}/reports"


def mails(kind):
    found = [json.loads(p.read_text()) for p in Path(MAIL_DIR).glob(f"{kind}-*.json")]
    return [m for m in found if m["kind"] == kind]


def token_of(mail):
    return mail["text"].split("#")[-1].split()[0].strip()


def put(client, **body):
    return client.put(base(client), json=body, headers=csrf(client))


def add(client, email="cliente.finale@example.com"):
    return client.post(f"{base(client)}/recipients", json={"email": email}, headers=csrf(client))


def on_plan(db, plan_id):
    db.execute(update(Workspace).values(plan_id=plan_id, trial_ends_at=None))
    db.commit()


def test_reports_are_a_plan_feature(client, db):
    signup(client)
    on_plan(db, "free")
    assert put(client, weekly=True).json()["code"] == "feature_locked"
    assert add(client).json()["code"] == "feature_locked"
    on_plan(db, "start")  # monthly only, 1 recipient
    assert put(client, weekly=True).json()["code"] == "feature_locked"
    assert put(client, monthly=True).json()["monthly"] is True
    assert add(client).status_code == 201
    assert add(client, "secondo@example.com").status_code == 409  # 1 recipient on Start


def test_double_opt_in_then_unsubscribe(client, db):
    signup(client)
    on_plan(db, "pro")
    view = add(client).json()
    assert view["recipients"][0]["status"] == "pending"  # nothing is sent before they confirm
    confirmation = mails("report-confirm")[0]
    assert confirmation["to"] == "cliente.finale@example.com"
    token = token_of(confirmation)
    assert (
        client.post(
            "/api/public/report-subscriptions/confirm", json={"token": "x" * 43}
        ).status_code
        == 400
    )
    ok = client.post("/api/public/report-subscriptions/confirm", json={"token": token})
    assert ok.status_code == 200 and ok.json()["company"] == "Azienda Demo"
    assert client.get(base(client)).json()["recipients"][0]["status"] == "active"
    unsub = db.scalar(select(ReportRecipient.unsub_token))
    assert (
        client.post(
            "/api/public/report-subscriptions/unsubscribe", json={"token": unsub}
        ).status_code
        == 200
    )
    assert client.get(base(client)).json()["recipients"][0]["status"] == "unsubscribed"
    again = add(client)  # asking again needs a new confirmation
    assert again.status_code == 201 and again.json()["recipients"][0]["status"] == "pending"


def confirmed(client, db, email="cliente.finale@example.com"):
    add(client, email)
    client.post("/api/public/report-subscriptions/confirm",
                json={"token": token_of(mails("report-confirm")[-1])})  # fmt: skip


def test_periods_are_complete_weeks_and_months_in_rome():
    wed = datetime(2026, 11, 18, 10, 0, tzinfo=ROME)
    start, end = period_for("weekly", wed.astimezone(UTC))
    assert end.astimezone(ROME) == datetime(2026, 11, 16, tzinfo=ROME)  # Monday 00:00
    assert (end - start) == timedelta(days=7)
    before_seven = datetime(2026, 11, 16, 6, 0, tzinfo=ROME)  # Monday, too early: previous week
    assert period_for("weekly", before_seven.astimezone(UTC))[1].astimezone(ROME).day == 9
    start, end = period_for("monthly", wed.astimezone(UTC))
    assert (start.astimezone(ROME).month, end.astimezone(ROME).month) == (10, 11)
    assert label("monthly", start, end) == "ottobre 2026"
    assert (
        label("weekly", *period_for("weekly", wed.astimezone(UTC)))
        == "dal 9 novembre al 15 novembre 2026"
    )


def test_scheduler_spreads_the_sending_and_is_idempotent(client, db):
    signup(client)
    on_plan(db, "pro")
    confirmed(client, db)
    put(client, weekly=True, monthly=True)
    at = datetime(2026, 12, 1, 9, 0, tzinfo=ROME).astimezone(UTC)  # a Tuesday, the 1st
    assert schedule(db, at) == 2  # one weekly + one monthly row
    db.commit()
    assert schedule(db, at) == 0  # idempotent
    rows = db.scalars(select(ReportLog)).all()
    assert all(at <= r.due_at < at + timedelta(minutes=180) for r in rows)


def test_report_content_branding_and_unsubscribe_link(client, db):
    signup(client)
    on_plan(db, "pro")
    qr = create(client).json()
    silent = create(client).json()
    for _ in range(3):
        follow(client, qr["slug"])
    start = now() - timedelta(days=3)
    db.execute(update(ScanEvent).values(scanned_at=start))
    from app.models import QrCode

    db.execute(update(QrCode).values(created_at=now() - timedelta(days=30)))
    confirmed(client, db)
    put(client, weekly=True)
    db.commit()
    from app.reports.service import collect

    data = collect(db, db.scalar(select(QrCode.company_id)), now() - timedelta(days=7), now())
    assert data["scans"] == 3 and data["top"][0][1] == 3 and silent["name"] in data["silent"]
    row = ReportLog(company_id=1, recipient_id=db.scalar(select(ReportRecipient.id)), kind="weekly",
                    period_start=now() - timedelta(days=7), period_end=now(), due_at=now() - timedelta(minutes=1))  # fmt: skip
    db.add(row)
    db.commit()
    assert send_due(db) == 1
    db.commit()
    sent = mails("report")[0]
    assert sent["to"] == "cliente.finale@example.com" and "Scansioni: 3" in sent["text"]
    assert (
        "/report/disiscrizione#" in sent["text"] and "Report generato con Vorya QR" in sent["text"]
    )


def test_unsubscribed_or_downgraded_recipients_get_nothing(client, db):
    signup(client)
    on_plan(db, "pro")
    confirmed(client, db)
    put(client, weekly=True)
    on_plan(db, "free")  # no plan feature any more: the scheduler skips it
    at = datetime(2026, 12, 1, 9, 0, tzinfo=ROME).astimezone(UTC)
    assert schedule(db, at) == 0


# ---------------------------------------------------------------- activation emails


def test_onboarding_emails_welcome_day_one_day_three_and_opt_out(client, db):
    from app.billing import jobs
    from app.billing.mail import send_pending
    from app.models import User

    signup(client)
    assert send_pending(db) == 1  # the welcome mail goes out with the signup
    db.commit()
    day = now() - timedelta(days=1, hours=1)
    db.execute(update(User).values(email_verified_at=day))
    db.commit()
    assert jobs.onboarding_emails(db) == 1  # no dynamic QR yet: quick guide
    db.commit()
    assert jobs.onboarding_emails(db) == 1 and send_pending(db) == 1  # idempotent keys
    db.commit()
    subjects = [m["subject"] for m in mails("billing")]
    assert "Benvenuto in Vorya QR" in subjects and any("primo QR dinamico" in s for s in subjects)
    # With a dynamic QR the day-1 guide is not needed; day 3 still introduces the pages.
    create(client)
    db.execute(update(User).values(email_verified_at=now() - timedelta(days=3, hours=1)))
    db.commit()
    jobs.onboarding_emails(db)
    db.commit()
    assert send_pending(db) == 1
    assert any("Scopri le pagine" in m["subject"] for m in mails("billing"))


def test_user_can_switch_activation_emails_off(client, db):
    from app.billing import jobs
    from app.billing.mail import send_pending
    from app.models import User

    signup(client)
    assert client.get("/api/account/mail-preferences").json() == {"onboarding": True}
    off = client.put(
        "/api/account/mail-preferences", json={"onboarding": False}, headers=csrf(client)
    )
    assert off.json() == {"onboarding": False}
    db.execute(update(User).values(email_verified_at=now() - timedelta(days=1, hours=1)))
    db.commit()
    jobs.onboarding_emails(db)
    db.commit()
    assert send_pending(db) == 0  # welcome + guide are skipped, nothing is sent
    assert mails("billing") == []
