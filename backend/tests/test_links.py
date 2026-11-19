from pathlib import Path

from sqlalchemy import update

from app.links.reserved import ROUTE_WORDS
from app.models import Plan
from tests.conftest import csrf, qrs, signup
from tests.test_redirect import follow

FRONTEND_APP = Path(__file__).resolve().parents[2] / "frontend" / "app"


def links(client):
    return qrs(client).replace("/qr-codes", "/links")


def test_every_app_route_is_reserved():
    """A first-level route missing here could be captured by a back-half (/{slug})."""

    def first_segments(folder: Path) -> set[str]:
        found = set()
        for child in folder.iterdir():
            if not child.is_dir():
                continue
            if child.name.startswith("("):  # route groups add no URL segment
                found |= first_segments(child)
            elif not child.name.startswith("["):
                found.add(child.name)
        return found

    assert first_segments(FRONTEND_APP) - ROUTE_WORDS == set()


def test_quick_short_link_then_generate_qr(client):
    signup(client)
    link = client.post(links(client), json={"target_url": "https://www.example.com/promo"},
                       headers=csrf(client))  # fmt: skip
    assert link.status_code == 201
    data = link.json()
    assert (data["has_qr"], data["kind"], data["name"]) == (False, "dynamic", "www.example.com")
    assert data["root_url"].endswith("/" + data["slug"]) and "/r/" in data["short_url"]
    assert follow(client, data["slug"]).headers["location"] == "https://www.example.com/promo"

    views = {v: [q["id"] for q in client.get(f"{qrs(client)}?view={v}").json()]
             for v in ("links", "dynamic_qr", "static")}  # fmt: skip
    assert views == {"links": [data["id"]], "dynamic_qr": [], "static": []}

    qr = client.post(f"{qrs(client)}/{data['id']}/generate-qr", headers=csrf(client)).json()
    assert qr["has_qr"] is True and qr["slug"] == data["slug"]
    assert client.get(f"{qrs(client)}?view=links").json() == []


def test_links_and_dynamic_qr_share_the_quota(client, db):
    signup(client)
    plan = db.get(Plan, "pro")
    plan.max_dynamic_qr = 1
    db.commit()
    assert client.post(links(client), json={"target_url": "https://a.example"},
                       headers=csrf(client)).status_code == 201  # fmt: skip
    over = client.post(links(client), json={"target_url": "https://b.example"},
                       headers=csrf(client))  # fmt: skip
    assert over.status_code == 409


def test_short_links_cannot_point_to_short_links(client):
    signup(client)
    for url in ("http://testserver/r/Ab3dEf7", "http://testserver/promo"):
        r = client.post(links(client), json={"target_url": url}, headers=csrf(client))
        assert r.status_code == 422, url


def test_static_qr_cannot_be_link_only(client):
    signup(client)
    wifi = {"ssid": "Casa", "security": "WPA", "password": "segreta123"}
    body = {"name": "W", "qr_type": "wifi", "has_qr": False, "static_data": wifi}
    assert client.post(qrs(client), json=body, headers=csrf(client)).status_code == 422


def test_scan_total_counts_humans_only(client, db):
    from app.models import QrCode

    signup(client)
    data = client.post(links(client), json={"target_url": "https://c.example"},
                       headers=csrf(client)).json()  # fmt: skip
    follow(client, data["slug"])
    follow(client, data["slug"], ua="curl/8")
    db.expire_all()
    assert db.get(QrCode, data["id"]).scan_total == 1
    db.execute(update(QrCode).values(scan_total=0))
    db.commit()
