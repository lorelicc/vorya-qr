import threading
from datetime import timedelta

from sqlalchemy import func, select, update

from app.core.database import session_factory
from app.core.errors import QuotaExceeded
from app.core.security import now
from app.models import Company, QrCode, ScanEvent, Workspace
from app.quotas import reserve_company
from app.worker import run_once
from tests.conftest import company_id, csrf, signup
from tests.test_qr import create


def new_company(client, name="Seconda azienda"):
    return client.post("/api/companies", json={"name": name}, headers=csrf(client))


def test_signup_creates_default_company_named_after_workspace(client):
    me = signup(client)
    companies = client.get("/api/companies").json()
    assert [c["name"] for c in companies] == ["Azienda Demo"]
    assert me["last_company_id"] == companies[0]["id"]
    assert companies[0]["qr_count"] == 0 and companies[0]["scans_7d"] == 0


def test_company_quota_is_atomic_and_counts_per_workspace(client):
    signup(client)  # trial = Pro limits: 3 companies
    assert new_company(client, "Due").status_code == 201
    assert new_company(client, "Tre").status_code == 201
    response = new_company(client, "Quattro")
    assert response.status_code == 409 and response.json()["code"] == "quota_companies"
    usage = client.get("/api/account/plan").json()["usage"]["companies"]
    assert usage == {"used": 3, "limit": 3, "over_limit": False, "can_create": False}


def test_concurrent_company_creation_never_exceeds_the_limit(client, db):
    me = signup(client)
    workspace_id = me["workspace"]["id"]
    barrier, results = threading.Barrier(6), []

    def worker(index: int):
        with session_factory()() as session:
            barrier.wait()
            try:
                reserve_company(session, workspace_id)
                session.add(Company(workspace_id=workspace_id, name=f"Parallela {index}"))
                session.commit()
                results.append("ok")
            except QuotaExceeded:
                session.rollback()
                results.append("quota")

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    total = db.scalar(select(func.count()).select_from(Company))
    assert results.count("ok") == 2 and total == 3  # 1 default + 2 allowed


def test_companies_are_isolated_between_accounts(client):
    signup(client, "a@example.com")
    cid = company_id(client)
    qr = create(client).json()
    client.cookies.clear()
    signup(client, "b@example.com")
    assert client.get(f"/api/companies/{cid}").status_code == 404
    assert client.get(f"/api/companies/{cid}/qr-codes").status_code == 404
    assert client.get(f"/api/companies/{cid}/qr-codes/{qr['id']}").status_code == 404
    other = company_id(client)
    assert client.get(f"/api/companies/{other}/qr-codes/{qr['id']}").status_code == 404
    body = {"company_id": cid}
    assert (
        client.put("/api/account/last-company", json=body, headers=csrf(client)).status_code == 404
    )


def test_qr_codes_are_isolated_between_companies_of_same_account(client):
    signup(client)
    first = company_id(client)
    qr = create(client).json()
    second = new_company(client).json()["id"]
    assert client.get(f"/api/companies/{second}/qr-codes/{qr['id']}").status_code == 404
    assert client.get(f"/api/companies/{second}/qr-codes").json() == []
    assert len(client.get(f"/api/companies/{first}/qr-codes").json()) == 1


def test_qr_quota_is_total_across_companies(client, db):
    signup(client)
    db.execute(update(Workspace).values(trial_ends_at=None, plan_id="start"))  # 3 dynamic
    db.commit()
    create(client)
    create(client)
    second = new_company(client)
    assert second.status_code == 409  # Start allows 1 company
    db.execute(update(Workspace).values(plan_id="pro"))
    db.commit()
    cid = new_company(client).json()["id"]
    client.put("/api/account/last-company", json={"company_id": cid}, headers=csrf(client))
    create(client)
    db.execute(update(Workspace).values(plan_id="start"))
    db.commit()
    response = create(client)
    assert response.status_code == 409 and response.json()["code"] == "quota_dynamic"


def test_delete_requires_exact_name_and_disables_redirects(client):
    signup(client)
    cid = company_id(client)
    qr = create(client).json()
    url = f"/api/companies/{cid}"
    wrong = client.request("DELETE", url, json={"confirm_name": "Altro"}, headers=csrf(client))
    assert wrong.status_code == 422
    ok = client.request("DELETE", url, json={"confirm_name": "Azienda Demo"}, headers=csrf(client))
    assert ok.status_code == 204
    assert client.get(url).status_code == 404
    assert client.get(f"/r/{qr['slug']}", follow_redirects=False).status_code == 410
    deleted = client.get("/api/companies?deleted=true").json()
    assert deleted[0]["id"] == cid and deleted[0]["purge_after"]
    assert client.post(f"{url}/restore", headers=csrf(client)).status_code == 200
    assert client.get(f"/r/{qr['slug']}", follow_redirects=False).status_code == 302


def test_restore_respects_company_quota(client, db):
    signup(client)
    cid = company_id(client)
    client.request(
        "DELETE",
        f"/api/companies/{cid}",
        json={"confirm_name": "Azienda Demo"},
        headers=csrf(client),
    )
    for name in ("B", "C", "D"):
        assert new_company(client, name).status_code == 201
    response = client.post(f"/api/companies/{cid}/restore", headers=csrf(client))
    assert response.status_code == 409


def test_worker_purges_after_30_days_keeping_slug_tombstones(client, db):
    signup(client)
    cid = company_id(client)
    qr = create(client).json()
    client.get(f"/r/{qr['slug']}", follow_redirects=False)
    client.request(
        "DELETE",
        f"/api/companies/{cid}",
        json={"confirm_name": "Azienda Demo"},
        headers=csrf(client),
    )
    db.execute(update(Company).values(purge_after=now() - timedelta(minutes=1)))
    db.commit()
    assert run_once()["purge_companies"] == 1
    db.expire_all()
    company = db.get(Company, cid)
    assert company.status == "purged" and company.name == "Azienda eliminata"
    tombstone = db.scalar(select(QrCode).where(QrCode.slug == qr["slug"]))
    assert tombstone is not None and tombstone.target_url == ""
    assert db.scalar(select(func.count()).select_from(ScanEvent)) == 0
    assert client.get(f"/r/{qr['slug']}", follow_redirects=False).status_code == 410
    assert client.post(f"/api/companies/{cid}/restore", headers=csrf(client)).status_code == 404


def test_last_company_is_remembered(client):
    signup(client)
    cid = new_company(client).json()["id"]
    assert (
        client.put(
            "/api/account/last-company", json={"company_id": cid}, headers=csrf(client)
        ).status_code
        == 204
    )
    assert client.get("/api/auth/me").json()["last_company_id"] == cid


def test_update_company_branding(client):
    signup(client)
    cid = company_id(client)
    body = {"name": "Nuovo nome", "primary_color": "#123ABC", "secondary_color": "#00e99a",
            "sector": "  Ristorazione "}  # fmt: skip
    data = client.put(f"/api/companies/{cid}", json=body, headers=csrf(client)).json()
    assert data["name"] == "Nuovo nome" and data["primary_color"] == "#123abc"
    assert data["sector"] == "Ristorazione"
    body["primary_color"] = "rosso"
    assert client.put(f"/api/companies/{cid}", json=body, headers=csrf(client)).status_code == 422
