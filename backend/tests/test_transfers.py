from datetime import timedelta

from sqlalchemy import select, update

from app.core.security import now
from app.models import AuditLog, Company, CompanyTransfer, QrCode, Workspace
from tests.conftest import (
    PASSWORD,
    company_id,
    csrf,
    last_mail,
    login,
    make_admin,
    signup,
    token_from,
)
from tests.test_qr import URL, create

SENDER, RECIPIENT = "mittente@example.com", "destinatario@example.com"


def setup_pair(client):
    """Recipient account first, then the sender with one dynamic QR. Returns (cid, qr)."""
    signup(client, RECIPIENT)
    client.cookies.clear()
    signup(client, SENDER)
    cid = company_id(client)
    return cid, create(client).json()


def request_transfer(client, cid, email=RECIPIENT):
    return client.post(
        f"/api/companies/{cid}/transfer", json={"email": email}, headers=csrf(client)
    )


def as_user(client, email):
    client.cookies.clear()
    assert login(client, email, PASSWORD).status_code == 200


def follow(client, slug):
    return client.get(f"/r/{slug}", follow_redirects=False)


def test_full_transfer_moves_company_and_keeps_qr_working(client, db):
    cid, qr = setup_pair(client)
    assert follow(client, qr["slug"]).headers["location"] == URL
    created = request_transfer(client, cid)
    assert created.status_code == 201 and created.json()["status"] == "pending"
    token = token_from(last_mail("transfer", RECIPIENT))
    assert follow(client, qr["slug"]).status_code == 302  # still working while pending

    as_user(client, RECIPIENT)
    listing = client.get("/api/company-transfers").json()
    assert listing["incoming"][0]["company"]["name"] == "Azienda Demo"
    resolved = client.post(
        "/api/company-transfers/by-token", json={"token": token}, headers=csrf(client)
    )
    assert resolved.status_code == 200
    tid = resolved.json()["id"]
    accepted = client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client))
    assert accepted.status_code == 200 and accepted.json()["status"] == "accepted"

    names = [c["name"] for c in client.get("/api/companies").json()]
    assert sorted(names) == ["Azienda Demo", "Azienda Demo"]  # recipient default + received
    assert client.get(f"/api/companies/{cid}/qr-codes/{qr['id']}").status_code == 200
    follow_after = follow(client, qr["slug"])
    assert follow_after.status_code == 302 and follow_after.headers["location"] == URL

    db.expire_all()
    company = db.get(Company, cid)
    moved = db.scalar(select(QrCode).where(QrCode.id == qr["id"]))
    assert moved.workspace_id == company.workspace_id  # denormalized owner in sync
    workspaces = {a.workspace_id for a in db.scalars(select(AuditLog).where(
        AuditLog.action == "transfer.accepted"))}  # fmt: skip
    assert len(workspaces) == 2
    assert "è ora nel tuo account" in last_mail("transfer", RECIPIENT)["text"]
    assert "è stata trasferita" in last_mail("transfer", SENDER)["text"]

    as_user(client, SENDER)
    assert client.get(f"/api/companies/{cid}").status_code == 404  # sender lost access


def test_create_validations(client):
    cid, _ = setup_pair(client)
    assert request_transfer(client, cid, "nessuno@example.com").status_code == 404
    assert request_transfer(client, cid, SENDER).status_code == 422
    assert request_transfer(client, cid).status_code == 201
    assert request_transfer(client, cid).status_code == 409  # one pending per company


def test_unverified_recipient_is_not_eligible(client):
    from tests.conftest import register

    register(client, "pending@example.com")
    signup(client, SENDER)
    assert request_transfer(client, company_id(client), "pending@example.com").status_code == 404


def test_decline_and_cancel(client):
    cid, _ = setup_pair(client)
    tid = request_transfer(client, cid).json()["id"]
    as_user(client, RECIPIENT)
    declined = client.post(f"/api/company-transfers/{tid}/decline", headers=csrf(client))
    assert declined.json()["status"] == "declined"
    assert "rifiutata" in last_mail("transfer", SENDER)["text"]
    as_user(client, SENDER)
    tid = request_transfer(client, cid).json()["id"]
    as_user(client, RECIPIENT)
    assert (
        client.post(f"/api/company-transfers/{tid}/cancel", headers=csrf(client)).status_code == 404
    )
    as_user(client, SENDER)
    cancelled = client.post(f"/api/company-transfers/{tid}/cancel", headers=csrf(client))
    assert cancelled.json()["status"] == "cancelled"
    as_user(client, RECIPIENT)
    assert (
        client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client)).status_code == 409
    )


def test_expired_transfer_cannot_be_accepted(client, db):
    cid, _ = setup_pair(client)
    tid = request_transfer(client, cid).json()["id"]
    db.execute(update(CompanyTransfer).values(expires_at=now() - timedelta(minutes=1)))
    db.commit()
    as_user(client, RECIPIENT)
    assert client.get("/api/company-transfers").json()["incoming"][0]["status"] == "expired"
    assert (
        client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client)).status_code == 409
    )
    db.expire_all()
    assert db.get(CompanyTransfer, tid).status == "expired"


def test_recipient_without_capacity_gets_a_clear_refusal(client, db):
    cid, qr = setup_pair(client)
    tid = request_transfer(client, cid).json()["id"]
    recipient_ws = db.scalar(select(Workspace).order_by(Workspace.id))
    recipient_ws.plan_id, recipient_ws.trial_ends_at = "start", None  # 1 company, already used
    db.commit()
    as_user(client, RECIPIENT)
    response = client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client))
    assert response.status_code == 409 and response.json()["code"] == "transfer_capacity"
    assert "aziende" in response.json()["detail"]
    db.expire_all()
    transfer = db.get(CompanyTransfer, tid)
    assert transfer.status == "pending" and transfer.failure_reason
    assert follow(client, qr["slug"]).status_code == 302


def test_blocked_recipient_cannot_accept(client, db):
    cid, _ = setup_pair(client)
    tid = request_transfer(client, cid).json()["id"]
    recipient_ws = db.scalar(select(Workspace).order_by(Workspace.id))
    recipient_ws.trial_ends_at = now() - timedelta(days=1)
    db.commit()
    as_user(client, RECIPIENT)
    assert (
        client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client)).status_code == 423
    )
    recipient_ws.trial_ends_at, recipient_ws.status = None, "suspended"
    db.commit()
    assert (
        client.post(f"/api/company-transfers/{tid}/accept", headers=csrf(client)).status_code == 423
    )


def test_deleting_company_cancels_pending_transfer(client, db):
    cid, _ = setup_pair(client)
    tid = request_transfer(client, cid).json()["id"]
    client.request(
        "DELETE",
        f"/api/companies/{cid}",
        json={"confirm_name": "Azienda Demo"},
        headers=csrf(client),
    )
    db.expire_all()
    assert db.get(CompanyTransfer, tid).status == "cancelled"


def test_admin_lists_transfers(client):
    cid, _ = setup_pair(client)
    request_transfer(client, cid)
    make_admin()
    as_user(client, "admin@example.com")
    rows = client.get("/api/admin/company-transfers").json()
    assert rows[0]["status"] == "pending" and rows[0]["to_email"] == RECIPIENT
