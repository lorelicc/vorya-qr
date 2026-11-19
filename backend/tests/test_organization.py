import io
import zipfile

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import ORIGIN, csrf, qrs, signup
from tests.test_links import links
from tests.test_qr import create


def base(client):
    return qrs(client).replace("/qr-codes", "")


def post(client, path, **body):
    return client.post(f"{base(client)}{path}", json=body, headers=csrf(client))


def put(client, path, **body):
    return client.put(f"{base(client)}{path}", json=body, headers=csrf(client))


def short_link(client, url="https://example.com/a", name=None):
    body = {"target_url": url, **({"name": name} if name else {})}
    return client.post(links(client), json=body, headers=csrf(client)).json()


def test_folders_nest_two_levels_and_deleting_never_deletes_links(client):
    signup(client)
    root = post(client, "/folders", name="Eventi").json()
    sub = post(client, "/folders", name="2026", parent_id=root["id"]).json()
    third = post(client, "/folders", name="Troppo", parent_id=sub["id"])
    assert third.status_code == 409 and third.json()["code"] == "max_depth"
    link = short_link(client)
    assert put(client, f"/qr-codes/{link['id']}/folder", folder_id=sub["id"]).status_code == 200

    listed = client.get(f"{base(client)}/folders").json()
    counts = {f["name"]: f["link_count"] for f in listed["folders"]}
    assert counts == {"Eventi": 0, "2026": 1} and listed["unfiled"] == 0
    # A folder with children cannot move under another (it would become level 3).
    other = post(client, "/folders", name="Altro").json()
    moved = put(client, f"/folders/{root['id']}", move=True, parent_id=other["id"])
    assert moved.status_code == 409
    own = put(client, f"/folders/{sub['id']}", move=True, parent_id=sub["id"])
    assert own.status_code == 409

    deleted = client.delete(f"{base(client)}/folders/{sub['id']}", headers=csrf(client))
    assert deleted.status_code == 204
    assert client.get(f"{qrs(client)}/{link['id']}").json()["folder_id"] == root["id"]


def test_folder_filter_includes_subfolders_and_unfiled(client):
    signup(client)
    root = post(client, "/folders", name="Eventi").json()
    sub = post(client, "/folders", name="2026", parent_id=root["id"]).json()
    a, b, c = (short_link(client, f"https://example.com/{i}", f"L{i}") for i in range(3))
    put(client, f"/qr-codes/{a['id']}/folder", folder_id=root["id"])
    put(client, f"/qr-codes/{b['id']}/folder", folder_id=sub["id"])

    def names(query):
        return sorted(q["name"] for q in client.get(f"{qrs(client)}?{query}").json())

    assert names(f"folder={root['id']}") == ["L0", "L1"]
    assert names(f"folder={sub['id']}") == ["L1"]
    assert names("folder=none") == ["L2"] and c["id"]


def test_tags_filters_sorting_and_combined_filters(client):
    signup(client)
    vip = post(client, "/tags", name="VIP", color="#FF0000").json()
    assert vip["color"] == "#ff0000"
    assert post(client, "/tags", name="vip").json()["code"] == "duplicate"
    summer = post(client, "/tags", name="Estate").json()
    a, b, c = (short_link(client, f"https://example.com/{i}", n) for i, n in enumerate("BAC"))
    put(client, f"/qr-codes/{a['id']}/tags", tag_ids=[vip["id"], summer["id"]])
    put(client, f"/qr-codes/{b['id']}/tags", tag_ids=[vip["id"]])
    listing = {q["name"]: q for q in client.get(qrs(client)).json()}
    assert sorted(listing["B"]["tag_ids"]) == sorted([vip["id"], summer["id"]])

    def names(query):
        return [q["name"] for q in client.get(f"{qrs(client)}?{query}").json()]

    assert sorted(names(f"tag_ids={vip['id']}")) == ["A", "B"]
    assert names(f"tag_ids={vip['id']}&tag_ids={summer['id']}") == ["B"]  # all tags must match
    assert names("sort=name&order=asc") == ["A", "B", "C"]
    assert names("sort=name&order=desc&view=links") == ["C", "B", "A"]
    assert names("scans_min=1") == [] and sorted(names("scans_max=0")) == ["A", "B", "C"]
    assert names("created_from=2999-01-01") == [] and c["id"]
    tags = {t["name"]: t["link_count"] for t in client.get(f"{base(client)}/tags").json()}
    assert tags == {"Estate": 1, "VIP": 2}


def test_bulk_actions_are_atomic_and_scoped(client):
    signup(client)
    folder = post(client, "/folders", name="Promo").json()
    tag = post(client, "/tags", name="Black Friday").json()
    ids = [short_link(client, f"https://example.com/{i}")["id"] for i in range(3)]
    assert post(
        client, "/qr-codes/bulk", ids=ids, action="move", folder_id=folder["id"]
    ).json() == {"updated": 3}
    assert (
        post(client, "/qr-codes/bulk", ids=ids, action="tag", tag_ids=[tag["id"]]).status_code
        == 200
    )
    assert post(client, "/qr-codes/bulk", ids=ids[:2], action="pause").status_code == 200
    states = {
        q["id"]: (q["status"], q["tag_ids"], q["folder_id"]) for q in client.get(qrs(client)).json()
    }
    assert states[ids[0]] == ("paused", [tag["id"]], folder["id"]) and states[ids[2]][0] == "active"
    assert (
        post(client, "/qr-codes/bulk", ids=ids, action="untag", tag_ids=[tag["id"]]).status_code
        == 200
    )

    # One foreign id fails the whole batch: nothing changes.
    with TestClient(app, base_url=ORIGIN) as other:
        signup(other, email="altro@example.com")
        theirs = short_link(other, "https://other.example")["id"]
    bad = post(client, "/qr-codes/bulk", ids=[*ids, theirs], action="pause")
    assert bad.status_code == 404
    assert client.get(f"{qrs(client)}/{ids[2]}").json()["status"] == "active"


def test_tags_and_folders_are_isolated_between_companies(client):
    signup(client)
    foreign_company = client.post("/api/companies", json={"name": "Seconda"}, headers=csrf(client))
    other_id = foreign_company.json()["id"]
    theirs = client.post(
        f"/api/companies/{other_id}/tags", json={"name": "X"}, headers=csrf(client)
    ).json()
    link = short_link(client)
    assert put(client, f"/qr-codes/{link['id']}/tags", tag_ids=[theirs["id"]]).status_code == 404
    folder = client.post(
        f"/api/companies/{other_id}/folders", json={"name": "F"}, headers=csrf(client)
    ).json()
    assert put(client, f"/qr-codes/{link['id']}/folder", folder_id=folder["id"]).status_code == 404


def test_bulk_zip_formats_and_names(client):
    signup(client)
    qr = create(client, name="Menu estate").json()
    twin = create(client, name="Menu estate").json()
    plain = short_link(client)  # no QR: skipped
    for fmt, magic in (("png", b"\x89PNG"), ("svg", b"<svg"), ("pdf", b"%PDF")):
        r = post(client, "/qr-codes/bulk-zip", ids=[qr["id"], twin["id"], plain["id"]], format=fmt)
        assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
        archive = zipfile.ZipFile(io.BytesIO(r.content))
        names = sorted(archive.namelist())
        assert names == [f"menu-estate-{twin['id']}.{fmt}", f"menu-estate.{fmt}"]
        assert all(archive.read(n).startswith(magic) for n in names)
    only_link = post(client, "/qr-codes/bulk-zip", ids=[plain["id"]], format="png")
    assert only_link.status_code == 422 and only_link.json()["code"] == "no_qr"


def test_global_search_finds_name_slug_alias_url_and_tag(client):
    signup(client)
    link = short_link(client, "https://example.com/vendemmia", "Promo uva")
    post(client, f"/qr-codes/{link['id']}/aliases", alias="vendemmia2026")
    client.post(f"{qrs(client)}/{link['id']}/aliases", json={"alias": "vendemmia2026"},
                headers=csrf(client))  # fmt: skip
    tag = post(client, "/tags", name="Autunno").json()
    put(client, f"/qr-codes/{link['id']}/tags", tag_ids=[tag["id"]])
    company = qrs(client).split("/")[3]

    def found(q, **extra):
        params = {"q": q, "company_id": company, **extra}
        return [r["id"] for r in client.get("/api/search", params=params).json()]

    for term in ("uva", link["slug"][:5], "vendemmia2026", "example.com/vendemmia", "autunno"):
        assert found(term) == [link["id"]], term
    assert found("inesistente") == []

    second = client.post("/api/companies", json={"name": "Seconda"}, headers=csrf(client)).json()
    mine = client.post(f"/api/companies/{second['id']}/links", headers=csrf(client),
                       json={"target_url": "https://example.com/promo", "name": "Promo due"}).json()  # fmt: skip
    assert found("promo") == [link["id"]]  # current company only
    assert sorted(found("promo", all_companies="true")) == sorted([link["id"], mine["id"]])
