"""Admin: add (invite), edit, archive/restore/purge clients; reset; companies, QR codes, audit."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.core.security import now
from app.main import app
from app.models import AuditLog, Company, QrCode, User, Workspace
from app.worker import purge_companies, purge_workspaces
from tests.conftest import ORIGIN, PASSWORD, csrf, last_mail, login, qrs, signup, token_from
from tests.test_admin_clients import admin, reader  # noqa: F401, F811  (fixtures)
from tests.test_billing import PROFILE
from tests.test_qr import create
from tests.test_redirect import follow

NEW = {"email": "Nuovo@Example.com", "display_name": "Anna Verdi", "workspace_name": "Bar Verdi"}


def invite(admin_client, **extra):
    return admin_client.post(
        "/api/admin/clients", json={**NEW, **extra}, headers=csrf(admin_client)
    )


def accept_invite(email: str, password=PASSWORD) -> TestClient:
    token = token_from(last_mail("invite", email))
    client = TestClient(app, base_url=ORIGIN)
    response = client.post(
        "/api/auth/verify-email",
        json={"token": token, "password": password, "confirm_password": password},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 200, response.text
    return client


def test_invite_creates_the_client_and_the_customer_sets_the_password(admin, db):
    created = invite(admin, plan_id="plus", trial_days=10)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["owner"]["email"] == "nuovo@example.com" and body["invited"] is True
    assert body["plan_id"] == "plus" and body["trial_ends_at"] is None  # starts at first access
    listed = admin.get("/api/admin/clients").json()
    assert [c["name"] for c in listed if c["invited"]] == ["Bar Verdi"]
    assert login(TestClient(app, base_url=ORIGIN), "nuovo@example.com").status_code != 200

    customer = accept_invite("nuovo@example.com")
    me = customer.get("/api/auth/me").json()
    assert me["email"] == "nuovo@example.com"
    ws = db.scalar(select(Workspace).where(Workspace.name == "Bar Verdi"))
    db.refresh(ws)
    assert ws.plan_id == "plus" and ws.trial_ends_at is not None
    assert 9 <= (ws.trial_ends_at - now()).days <= 10
    assert customer.get("/api/account/plan").json()["plan"]["id"] == "plus"
    assert admin.get(f"/api/admin/clients/{ws.id}").json()["invited"] is False


def test_invite_validation_and_permissions(admin, reader):
    assert invite(admin).status_code == 201
    assert invite(admin).status_code == 409  # same email
    assert invite(admin, email="altro@example.com", plan_id="inesistente").status_code == 422
    assert reader.post("/api/admin/clients", json=NEW, headers=csrf(reader)).status_code == 403
    free = invite(admin, email="free@example.com", plan_id="free", trial_days=30).json()
    assert free["plan_id"] == "free"
    accept = accept_invite("free@example.com")
    assert accept.get("/api/account/plan").json()["plan"]["id"] == "free"  # no trial on Free


def test_edit_client_and_audit_trail(admin):
    cid = invite(admin).json()["id"]
    edited = admin.patch(
        f"/api/admin/clients/{cid}",
        json={"workspace_name": "Bar Verdi 2", "display_name": "Anna V.",
              "email": "anna@example.com", "profile": PROFILE},
        headers=csrf(admin),
    )  # fmt: skip
    assert edited.status_code == 200, edited.text
    body = edited.json()
    assert body["name"] == "Bar Verdi 2" and body["owner"]["email"] == "anna@example.com"
    assert body["profile"]["legal_name"] == "Rossi Srl"
    clash = admin.patch(
        f"/api/admin/clients/{cid}", json={"email": "admin@example.com"}, headers=csrf(admin)
    )
    assert clash.status_code == 409
    bad = admin.patch(
        f"/api/admin/clients/{cid}",
        json={"profile": {**PROFILE, "vat": "123"}},
        headers=csrf(admin),
    )
    assert bad.status_code == 422
    trail = admin.get(f"/api/admin/clients/{cid}/audit").json()
    assert [a["action"] for a in trail][:2] == ["admin.client_edited", "admin.client_created"]
    assert trail[0]["actor"] == "admin@example.com"


def test_resend_invite_and_reset_password(admin):
    cid = invite(admin).json()["id"]
    assert (
        admin.post(f"/api/admin/clients/{cid}/reset-password", headers=csrf(admin)).status_code
        == 409
    )
    assert (
        admin.post(f"/api/admin/clients/{cid}/resend-invite", headers=csrf(admin)).status_code
        == 204
    )
    accept_invite("nuovo@example.com")
    assert (
        admin.post(f"/api/admin/clients/{cid}/resend-invite", headers=csrf(admin)).status_code
        == 409
    )
    assert (
        admin.post(f"/api/admin/clients/{cid}/reset-password", headers=csrf(admin)).status_code
        == 204
    )
    assert last_mail("reset", "nuovo@example.com")["to"] == "nuovo@example.com"
    assert (
        admin.post(f"/api/admin/clients/{cid}/revoke-sessions", headers=csrf(admin)).status_code
        == 204
    )


def test_archive_switches_everything_off_and_restore_brings_it_back(admin, client, db):
    me = signup(client, "cliente@example.com")
    cid = db.scalar(select(Workspace.id).where(Workspace.owner_user_id == me["id"]))
    qr = create(client).json()
    assert follow(client, qr["slug"]).status_code == 302
    url = f"/api/admin/clients/{cid}"
    wrong = admin.request("DELETE", url, json={"confirm_name": "sbagliato"}, headers=csrf(admin))
    assert wrong.status_code == 422
    name = admin.get(url).json()["name"]
    done = admin.request("DELETE", url, json={"confirm_name": name}, headers=csrf(admin))
    assert done.status_code == 204, done.text
    assert follow(client, qr["slug"]).status_code == 410  # "QR non attivo"
    assert client.get("/api/auth/me").status_code == 401  # sessions revoked
    assert login(TestClient(app, base_url=ORIGIN), "cliente@example.com").status_code != 200
    assert cid not in [c["id"] for c in admin.get("/api/admin/clients").json()]
    archived = admin.get("/api/admin/clients", params={"archived": "true"}).json()
    assert [c["id"] for c in archived] == [cid] and archived[0]["purge_after"]
    assert admin.post(f"{url}/resend-invite", headers=csrf(admin)).status_code == 409  # read-only

    restored = admin.post(f"{url}/restore", headers=csrf(admin))
    assert restored.status_code == 200, restored.text
    assert follow(client, qr["slug"]).status_code == 302
    assert login(TestClient(app, base_url=ORIGIN), "cliente@example.com").status_code == 200
    actions = [a["action"] for a in admin.get(f"{url}/audit").json()]
    assert actions[:2] == ["admin.client_restored", "admin.client_archived"]


def test_archive_after_30_days_anonymises_but_keeps_the_addresses(admin, client, db):
    me = signup(client, "vecchio@example.com")
    cid = db.scalar(select(Workspace.id).where(Workspace.owner_user_id == me["id"]))
    qr = create(client).json()
    name = admin.get(f"/api/admin/clients/{cid}").json()["name"]
    url = f"/api/admin/clients/{cid}"
    assert (
        admin.request("DELETE", url, json={"confirm_name": name}, headers=csrf(admin)).status_code
        == 204
    )
    past = now() - timedelta(minutes=1)
    db.execute(update(Workspace).where(Workspace.id == cid).values(purge_after=past))
    db.execute(update(Company).where(Company.workspace_id == cid).values(purge_after=past))
    db.commit()
    assert purge_companies(db) >= 1 and purge_workspaces(db) == 1
    db.commit()
    owner = db.get(User, me["id"])
    assert owner.email == f"deleted-{owner.id}@vorya.invalid" and owner.password_hash is None
    ws = db.get(Workspace, cid)
    assert ws.status == "purged" and ws.name == "Cliente eliminato"
    assert follow(client, qr["slug"]).status_code == 410  # tombstone: never reassigned
    assert db.scalar(select(QrCode.id).where(QrCode.slug == qr["slug"])) is not None
    assert admin.post(f"{url}/restore", headers=csrf(admin)).status_code == 410
    assert db.scalar(select(AuditLog.id).where(AuditLog.action == "client.purged")) is not None


def test_admin_manages_qr_codes_and_companies_of_a_client(admin, client, db):
    me = signup(client, "gestito@example.com")
    cid = db.scalar(select(Workspace.id).where(Workspace.owner_user_id == me["id"]))
    qr = create(client).json()
    url = f"/api/admin/clients/{cid}"
    listed = admin.get(f"{url}/qr-codes").json()
    assert listed["total"] == 1 and listed["items"][0]["slug"] == qr["slug"]
    assert admin.get(f"{url}/qr-codes", params={"search": "zzz"}).json()["items"] == []
    block = admin.post(
        f"{url}/qr-codes/{qr['id']}/block", json={"note": "abuso"}, headers=csrf(admin)
    )
    assert block.status_code == 204 and follow(client, qr["slug"]).status_code == 410
    assert admin.get(f"{url}/qr-codes").json()["items"][0]["status"] == "blocked"
    assert (
        admin.post(f"{url}/qr-codes/{qr['id']}/unblock", json={}, headers=csrf(admin)).status_code
        == 204
    )
    assert follow(client, qr["slug"]).status_code == 302
    gone = admin.post(f"{url}/qr-codes/{qr['id']}/delete", json={}, headers=csrf(admin))
    assert gone.status_code == 204 and follow(client, qr["slug"]).status_code == 410
    assert (
        admin.post(f"{url}/qr-codes/999999/block", json={}, headers=csrf(admin)).status_code == 404
    )

    company = db.scalar(select(Company).where(Company.workspace_id == cid))
    assert (
        admin.post(f"{url}/companies/{company.id}/delete", headers=csrf(admin)).status_code == 204
    )
    detail = admin.get(url).json()
    assert detail["companies"][0]["status"] == "deleted"
    assert (
        admin.post(f"{url}/companies/{company.id}/restore", headers=csrf(admin)).status_code == 204
    )
    assert admin.get(url).json()["companies"][0]["status"] == "active"
    assert qrs(client)  # the customer's own area still works after the restore
