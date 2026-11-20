from datetime import timedelta

from sqlalchemy import select, update

from app.core.security import now
from app.models import Workspace
from tests.conftest import ORIGIN, csrf, login, make_admin, qrs, signup
from tests.test_qr import create


def set_plan_limits(db, plan_id, static, dynamic):
    from app.models import Plan

    db.execute(
        update(Plan).where(Plan.id == plan_id).values(max_qr_static=static, max_dynamic_qr=dynamic)
    )
    db.commit()


def test_quota_blocks_creation_with_409(client, db):
    signup(client)
    set_plan_limits(db, "pro", 1, 1)
    assert create(client).status_code == 201
    response = create(client)
    assert response.status_code == 409
    assert response.json()["code"] == "quota_dynamic"
    assert create(client, kind="static").status_code == 201
    assert create(client, kind="static").json()["code"] == "quota_static"


def test_deleted_qr_frees_the_slot(client, db):
    signup(client)
    set_plan_limits(db, "pro", 0, 1)
    qr = create(client).json()
    client.delete(f"{qrs(client)}/{qr['id']}", headers=csrf(client))
    assert create(client).status_code == 201


def test_unlimited_plan(client, db):
    signup(client)
    set_plan_limits(db, "pro", None, None)
    assert all(create(client, kind="static").status_code == 201 for _ in range(3))


def test_plan_downgrade_keeps_qr_and_reports_over_limit(client, db):
    signup(client)
    for _ in range(4):
        create(client)
    workspace = db.scalar(select(Workspace))
    workspace.plan_id, workspace.trial_ends_at = "free", None  # Free: 2 dynamic per company
    db.commit()
    items = client.get(f"{qrs(client)}").json()
    assert len(items) == 4  # nothing is deleted or switched off
    plan = client.get("/api/account/plan").json()
    assert plan["usage"]["dynamic"] == {
        "used": 4,
        "limit": 2,
        "over_limit": True,
        "can_create": False,
        "per_company": True,
    }
    # The oldest fit, the newest are read-only (and still served).
    by_id = sorted(items, key=lambda q: q["id"])
    assert [q["locked"] for q in by_id] == [False, False, True, True]
    assert by_id[2]["locked_reason"] == "quota"
    response = create(client)
    assert response.status_code == 409 and "più QR dinamici" in response.json()["detail"]


def expire_trial(db):
    db.execute(update(Workspace).values(trial_ends_at=now() - timedelta(minutes=1)))
    db.commit()


def test_trial_expired_moves_to_free_and_blocks_nothing(client, db):
    signup(client)
    qr = create(client).json()
    expire_trial(db)
    assert client.get(f"{qrs(client)}").status_code == 200  # the dashboard is never blocked
    me = client.get("/api/auth/me").json()
    assert me["workspace"]["access"] == "free"
    plan = client.get("/api/account/plan").json()
    assert plan["plan"]["id"] == "free" and plan["access"] == "free"
    assert client.get(f"/r/{qr['slug']}", follow_redirects=False).status_code == 302


def test_suspended_blocks_user_api(client, db):
    signup(client)
    db.execute(update(Workspace).values(status="suspended"))
    db.commit()
    response = client.get("/api/account/plan")
    assert response.status_code == 423 and response.json()["code"] == "suspended"


def test_admin_assigns_plan_and_suspends(client, db):
    me = signup(client)
    workspace_id = me["workspace"]["id"]
    client.cookies.clear()
    make_admin()
    assert login(client, "admin@example.com").status_code == 200
    rows = client.get("/api/admin/workspaces").json()
    assert rows[0]["owner"]["email"] == "cliente@example.com" and rows[0]["access"] == "trial"
    url = f"/api/admin/workspaces/{workspace_id}"
    data = client.put(f"{url}/plan", json={"plan_id": "plus"}, headers=csrf(client)).json()
    assert data["plan_id"] == "plus" and data["access"] == "active"
    assert data["trial_ends_at"] is None
    data = client.post(f"{url}/suspend", headers=csrf(client)).json()
    assert data["access"] == "suspended"
    data = client.post(f"{url}/reactivate", headers=csrf(client)).json()
    assert data["access"] == "active"
    assert (
        client.put(f"{url}/plan", json={"plan_id": "nope"}, headers=csrf(client)).status_code == 404
    )


def test_admin_updates_plan_limits(client):
    make_admin()
    login(client, "admin@example.com")
    body = {"name": "Start", "description": "x", "max_qr_static": 5, "max_dynamic_qr": None}
    data = client.put("/api/admin/plans/start", json=body, headers=csrf(client)).json()
    assert data["max_qr_static"] == 5 and data["max_dynamic_qr"] is None


def test_platform_admin_is_read_only(client):
    make_admin("ops@example.com", "platform_admin")
    login(client, "ops@example.com")
    assert client.get("/api/admin/workspaces").status_code == 200
    body = {"name": "Start", "max_qr_static": 1, "max_dynamic_qr": 1}
    assert client.put("/api/admin/plans/start", json=body, headers=csrf(client)).status_code == 403


def test_customer_cannot_use_admin_api_and_admin_has_no_workspace(client):
    signup(client)
    assert client.get("/api/admin/workspaces").status_code == 403
    client.cookies.clear()
    make_admin()
    login(client, "admin@example.com")
    assert client.get(f"{qrs(client)}").status_code == 403


def test_cli_rejects_duplicate_and_short_password():
    import pytest

    from app.cli import create_admin

    make_admin()
    with pytest.raises(SystemExit):
        create_admin("admin@example.com", "Altro", "super_admin", "una-password-sicura-123")
    with pytest.raises(ValueError):
        create_admin("new@example.com", "Altro", "super_admin", "corta")
    assert ORIGIN
