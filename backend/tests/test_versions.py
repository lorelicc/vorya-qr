from sqlalchemy import select, update

from app.core.security import now
from app.links.versions import KEEP, prune
from app.models import LinkVersion, StoredFile, Workspace
from tests.conftest import csrf, qrs, signup
from tests.test_files import pdf_bytes, upload
from tests.test_links import links
from tests.test_pages_types import create_page_qr, vcard_page
from tests.test_qr import create
from tests.test_redirect import follow


def update_qr(client, qr_id, **body):
    body.setdefault("name", "Link")
    return client.put(f"{qrs(client)}/{qr_id}", json=body, headers=csrf(client))


def versions(client, qr_id, query=""):
    return client.get(f"{qrs(client)}/{qr_id}/versions{query}").json()


def test_every_content_save_creates_a_version(client):
    signup(client)
    qr = create(client).json()
    update_qr(client, qr["id"], target_url="https://example.com/due")
    update_qr(client, qr["id"], target_url="https://example.com/due")  # same content, still saved
    found = versions(client, qr["id"])
    assert [(v["number"], v["change"]) for v in found] == [
        (3, "content"),
        (2, "destination"),
        (1, "created"),
    ]
    assert found[0]["author"] == "Mario Rossi" or found[0]["author"]


def test_type_change_keeps_slug_design_and_restores_previous_version(client):
    signup(client)
    page = create_page_qr(client, "vcard", vcard_page()).json()
    follow_before = client.get(f"/r/{page['slug']}", follow_redirects=False)
    assert follow_before.headers["x-vorya-destination"] == "page"

    changed = update_qr(client, page["id"], qr_type="website", target_url="https://example.com/sito",
                        design={"modules": "dots"})  # fmt: skip
    assert changed.status_code == 200, changed.text
    assert changed.json()["slug"] == page["slug"] and changed.json()["qr_type"] == "website"
    assert follow(client, page["slug"]).headers["location"] == "https://example.com/sito"
    assert client.get(f"{qrs(client)}/{page['id']}/page").status_code == 404  # page row gone

    # Going back: restoring v1 brings the vCard page back on the same slug, design untouched.
    restored = client.post(f"{qrs(client)}/{page['id']}/versions/1/restore", headers=csrf(client))
    assert restored.status_code == 200 and restored.json()["qr_type"] == "vcard"
    assert (
        client.get(f"/r/{page['slug']}", follow_redirects=False).headers["x-vorya-destination"]
        == "page"
    )
    assert restored.json()["design"]["modules"] == "dots"
    history = versions(client, page["id"])
    assert [v["change"] for v in history] == ["restore", "type", "created"]

    # The form is prefilled with the last version of a type used before.
    last_site = versions(client, page["id"], "?qr_type=website")
    assert last_site[0]["target_url"] == "https://example.com/sito"
    assert last_site[0]["qr_type"] == "website"


def test_static_qr_cannot_change_type(client):
    signup(client)
    static = create(client, kind="static").json()
    wifi = {"ssid": "Casa", "security": "WPA", "password": "segreta123"}
    r = update_qr(client, static["id"], qr_type="wifi", static_data=wifi)
    assert r.status_code == 409 and r.json()["code"] == "static_type_locked"
    same = update_qr(client, static["id"], qr_type="website", static_data={"url": "https://e.com"})
    assert same.status_code == 200  # same type: normal edit
    assert client.get(f"{qrs(client)}/{static['id']}/versions").status_code in (200, 404)


def test_type_must_be_included_in_the_plan(client, db):
    signup(client)
    link = client.post(links(client), json={"target_url": "https://example.com"},
                       headers=csrf(client)).json()  # fmt: skip
    db.execute(update(Workspace).values(plan_id="free", trial_ends_at=None))
    db.commit()
    r = update_qr(client, link["id"], qr_type="pdf", page=None)
    assert r.status_code == 403 and r.json()["code"] == "feature_locked"


def test_history_is_a_plan_feature(client, db):
    signup(client)
    qr = create(client).json()
    db.execute(update(Workspace).values(plan_id="free", trial_ends_at=None))
    db.commit()
    assert client.get(f"{qrs(client)}/{qr['id']}/versions").json()["code"] == "feature_locked"


def test_restore_with_a_deleted_file_is_refused_cleanly(client, db):
    signup(client)
    uploaded = upload(client, pdf_bytes(), "pdf", "m.pdf")
    assert uploaded.status_code == 201
    block = {"id": "f", "type": "file", "file_id": uploaded.json()["id"], "label": "Menu"}
    page = {"template": "pdf", "theme": vcard_page()["theme"], "blocks": [block]}
    qr = create_page_qr(client, "pdf", page).json()
    update_qr(client, qr["id"], qr_type="website", target_url="https://example.com")
    db.execute(update(StoredFile).values(deleted_at=now()))
    db.commit()
    r = client.post(f"{qrs(client)}/{qr['id']}/versions/1/restore", headers=csrf(client))
    assert r.status_code == 422


def test_stats_markers_for_type_and_destination_changes(client):
    signup(client)
    qr = create(client).json()
    update_qr(client, qr["id"], target_url="https://example.com/nuovo")
    update_qr(client, qr["id"], qr_type="link_in_bio",
              page={"template": "link_in_bio", "theme": vcard_page()["theme"],
                    "blocks": [{"id": "l", "type": "link_list", "items": []}]})  # fmt: skip
    markers = client.get(f"{qrs(client)}/{qr['id']}/stats").json()["markers"]
    assert [m["change"] for m in markers] == ["destination", "type"]


def test_worker_keeps_the_last_20_versions(client, db):
    signup(client)
    qr = create(client).json()
    for i in range(24):
        update_qr(client, qr["id"], target_url=f"https://example.com/{i}")
    assert db.query(LinkVersion).count() == 25
    removed = prune(db)
    db.commit()
    assert removed == 5
    numbers = [n for (n,) in db.execute(select(LinkVersion.number).order_by(LinkVersion.number))]
    assert numbers == list(range(6, 26)) and len(numbers) == KEEP


def test_files_only_in_pruned_versions_are_released(client, db):
    signup(client)
    qr = create(client).json()
    from app.models import Company

    company = db.scalar(select(Company))
    file = StoredFile(id="11111111-1111-1111-1111-111111111111", company_id=company.id,
                      workspace_id=company.workspace_id, kind="image", purpose="image",
                      mime="image/webp", original_name="x.webp", size_bytes=10, sha256="0" * 64,
                      variants={}, qr_code_id=qr["id"])  # fmt: skip
    db.add(file)
    db.query(LinkVersion).filter(LinkVersion.number == 1).update({"file_ids": [file.id]})
    db.commit()
    for i in range(22):
        update_qr(client, qr["id"], target_url=f"https://example.com/{i}")
    prune(db)
    db.commit()
    db.refresh(file)
    assert file.deleted_at is not None
