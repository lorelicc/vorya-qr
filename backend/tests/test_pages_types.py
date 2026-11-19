from sqlalchemy import func, select, update

from app.models import ScanEvent, Workspace
from app.qr.static_types import encode_static
from tests.conftest import company_id, csrf, qrs, signup
from tests.test_files import MP3, pdf_bytes, upload

THEME = {"primary": "#087f5b", "secondary": "#00e99a"}


def vcard_page(**contact):
    return {
        "template": "vcard",
        "theme": THEME,
        "blocks": [
            {"id": "h", "type": "header", "title": "Giulia Bianchi", "subtitle": "Sala"},
            {
                "id": "c",
                "type": "contact",
                "first_name": "Giulia",
                "last_name": "Bianchi; Rossi",
                "organization": "Pizzeria, Da Mario",
                "phones": [{"label": "cell", "number": "+39 333 1234567"}],
                "emails": [{"label": "work", "address": "giulia@example.com"}],
                "website": "https://example.com",
                "address": {"street": "Via Roma 1", "city": "Milano", "postal_code": "20121"},
                "note": "Nota lunga " * 12,
                **contact,
            },
            {"id": "t", "type": "text", "markdown": "<script>alert(1)</script> **ciao**"},
        ],
    }


def create_page_qr(client, qr_type, page, name="Pagina"):
    body = {"name": name, "qr_type": qr_type, "page": page}
    return client.post(qrs(client), json=body, headers=csrf(client))


def test_vcard_page_flow_redirect_public_data_and_vcf(client, db):
    signup(client)
    response = create_page_qr(client, "vcard", vcard_page())
    assert response.status_code == 201, response.text
    qr = response.json()
    assert (qr["kind"], qr["destination"], qr["qr_type"]) == ("dynamic", "page", "vcard")
    hop = client.get(f"/r/{qr['slug']}", follow_redirects=False)
    assert hop.status_code == 200 and hop.headers["x-vorya-destination"] == "page"
    assert hop.headers["cache-control"] == "no-store"
    assert db.scalar(select(func.count()).select_from(ScanEvent)) == 1
    public = client.get(f"/api/public/pages/{qr['slug']}").json()
    assert public["page"]["blocks"][2]["markdown"].startswith("<script>")  # stored as text
    assert public["company"]["name"] == "Azienda Demo"
    assert db.scalar(select(func.count()).select_from(ScanEvent)) == 1  # data fetch not counted
    vcf = client.get(f"/api/public/pages/{qr['slug']}/vcard/c.vcf")
    assert vcf.headers["content-type"].startswith("text/vcard")
    text = vcf.text
    assert text.startswith("BEGIN:VCARD\r\nVERSION:3.0\r\n") and text.endswith("END:VCARD\r\n")
    assert "N:Bianchi\\; Rossi;Giulia;;;" in text and "ORG:Pizzeria\\, Da Mario" in text
    assert "TEL;TYPE=CELL:+39 333 1234567" in text
    assert all(len(line.encode()) <= 75 for line in text.split("\r\n"))
    assert client.get(f"/api/public/pages/{qr['slug']}/vcard/h.vcf").status_code == 404


def test_paused_page_is_not_public(client):
    signup(client)
    qr = create_page_qr(client, "vcard", vcard_page()).json()
    client.post(f"{qrs(client)}/{qr['id']}/pause", headers=csrf(client))
    assert client.get(f"/r/{qr['slug']}", follow_redirects=False).status_code == 410
    assert client.get(f"/api/public/pages/{qr['slug']}").status_code == 404


def test_template_rules(client):
    signup(client)
    no_contact = {"template": "vcard", "blocks": [{"id": "h", "type": "header"}]}
    assert create_page_qr(client, "vcard", no_contact).status_code == 422
    wrong_block = vcard_page()
    wrong_block["blocks"].append({"id": "g", "type": "gallery", "file_ids": ["0" * 36]})
    assert create_page_qr(client, "vcard", wrong_block).status_code == 422
    duplicate = vcard_page()
    duplicate["blocks"][1]["id"] = "h"
    assert create_page_qr(client, "vcard", duplicate).status_code == 422
    mismatch = create_page_qr(client, "link_in_bio", vcard_page())
    assert mismatch.status_code == 422
    bad_url = {
        "template": "link_in_bio",
        "blocks": [
            {
                "id": "l",
                "type": "link_list",
                "items": [{"label": "x", "url": "javascript:alert(1)"}],
            }
        ],
    }
    assert create_page_qr(client, "link_in_bio", bad_url).status_code == 422


def music_page(track_id):
    return {
        "template": "music",
        "blocks": [
            {"id": "h", "type": "header", "title": "Notte Verde"},
            {"id": "a", "type": "audio_player",
             "tracks": [{"file_id": track_id, "title": "Intro"}]},
            {"id": "m", "type": "music_links", "links": [
                {"platform": "spotify", "url": "https://open.spotify.com/album/x"}]},
        ],
    }  # fmt: skip


def test_music_page_requires_own_audio_files(client):
    signup(client, "a@example.com")
    foreign_audio = upload(client, MP3, "audio").json()["id"]
    client.cookies.clear()
    signup(client, "b@example.com")
    assert create_page_qr(client, "music", music_page(foreign_audio)).status_code == 422
    pdf = upload(client, pdf_bytes(1), "pdf").json()["id"]
    assert create_page_qr(client, "music", music_page(pdf)).status_code == 422
    own = upload(client, MP3, "audio").json()["id"]
    qr = create_page_qr(client, "music", music_page(own))
    assert qr.status_code == 201
    files = client.get(f"/api/public/pages/{qr.json()['slug']}").json()["files"]
    assert files[own]["kind"] == "audio" and files[own]["urls"]["original"] == f"/f/{own}/original"


def test_pdf_page_and_update_via_put(client):
    signup(client)
    pdf = upload(client, pdf_bytes(2), "pdf").json()
    page = {"template": "pdf", "blocks": [{"id": "f", "type": "file", "file_id": pdf["id"]}]}
    qr = create_page_qr(client, "pdf", page).json()
    assert client.get(f"{qrs(client)}/{qr['id']}/page").json()["blocks"][0]["file_id"] == pdf["id"]
    page["blocks"].insert(0, {"id": "h", "type": "header", "title": "Menu"})
    body = {"name": "Menu PDF", "page": page}
    updated = client.put(f"{qrs(client)}/{qr['id']}", json=body, headers=csrf(client))
    assert updated.status_code == 200
    public = client.get(f"/api/public/pages/{qr['slug']}").json()
    assert public["files"][pdf["id"]]["pages"] == 2
    assert [b["type"] for b in public["page"]["blocks"]] == ["header", "file"]


def test_plan_gates_types_and_branding(client, db):
    signup(client)
    db.execute(update(Workspace).values(plan_id="start", trial_ends_at=None))
    db.commit()
    pdf = upload(client, pdf_bytes(1), "pdf").json()["id"]
    locked = create_page_qr(client, "pdf", {"template": "pdf", "blocks": [
        {"id": "f", "type": "file", "file_id": pdf}]})  # fmt: skip
    assert locked.status_code == 403 and locked.json()["code"] == "feature_locked"
    assert "piano Pro" in locked.json()["detail"]
    page = vcard_page()
    page["settings"] = {"show_branding": False}
    qr = create_page_qr(client, "vcard", page).json()
    public = client.get(f"/api/public/pages/{qr['slug']}").json()
    assert public["page"]["settings"]["show_branding"] is True  # Start cannot hide it
    db.execute(update(Workspace).values(plan_id="pro"))
    db.commit()
    public = client.get(f"/api/public/pages/{qr['slug']}").json()
    assert public["page"]["settings"]["show_branding"] is False


def test_static_types_payloads():
    assert encode_static("wifi", {"ssid": 'Bar;Casa"1', "password": "a:b,c", "hidden": True}) == (
        'WIFI:T:WPA;S:Bar\\;Casa\\"1;P:a\\:b\\,c;H:true;;'
    )
    assert (
        encode_static("wifi", {"ssid": "Ospiti", "encryption": "nopass"})
        == "WIFI:T:nopass;S:Ospiti;;"
    )
    assert encode_static("email", {"to": "a@b.it", "subject": "Ciao a tutti"}) == (
        "mailto:a@b.it?subject=Ciao%20a%20tutti"
    )
    assert encode_static("sms", {"number": "+39 333 12", "message": "Ok"}) == "SMSTO:+3933312:Ok"
    assert encode_static("phone", {"number": "+39 (02) 123"}) == "tel:+3902123"
    assert encode_static("whatsapp", {"number": "+39 333", "message": "Ciao!"}) == (
        "https://wa.me/39333?text=Ciao%21"
    )
    assert encode_static("text", {"text": "Ciao"}) == "Ciao"


def test_static_qr_creation_and_validation(client):
    signup(client)
    body = {"name": "Wi-Fi", "qr_type": "wifi", "static_data": {"ssid": "Ospiti", "password": "x"}}
    qr = client.post(qrs(client), json=body, headers=csrf(client)).json()
    assert qr["kind"] == "static" and qr["slug"] is None and qr["static_data"]["ssid"] == "Ospiti"
    bad = {"name": "Mail", "qr_type": "email", "static_data": {"to": "non-una-email"}}
    response = client.post(qrs(client), json=bad, headers=csrf(client))
    assert response.status_code == 422 and response.json()["errors"][0]["field"] == "static_data"
    preview = {"qr_type": "phone", "static_data": {"number": "+39 02 1234"}}
    data = client.post(f"{qrs(client)}/preview", json=preview, headers=csrf(client)).json()
    assert data["content"] == "tel:+39021234"
    svg = client.get(f"{qrs(client)}/{qr['id']}/image.svg")
    assert svg.status_code == 200


def test_duplicate_keeps_content_and_gets_new_slug(client):
    signup(client)
    qr = create_page_qr(client, "vcard", vcard_page(), name="Biglietto").json()
    copy = client.post(f"{qrs(client)}/{qr['id']}/duplicate", headers=csrf(client))
    assert copy.status_code == 201
    data = copy.json()
    assert data["name"] == "Biglietto (copia)" and data["slug"] != qr["slug"]
    page = client.get(f"{qrs(client)}/{data['id']}/page").json()
    assert page["blocks"][1]["first_name"] == "Giulia"


def test_page_types_count_as_dynamic_quota(client, db):
    from app.models import Plan

    signup(client)
    plan = db.get(Plan, "pro")
    plan.max_dynamic_qr = 1
    db.commit()
    assert create_page_qr(client, "vcard", vcard_page()).status_code == 201
    second = create_page_qr(client, "vcard", vcard_page())
    assert second.status_code == 409 and second.json()["code"] == "quota_dynamic"
    assert company_id(client)


def test_vcard_with_website_typed_without_scheme_is_completed_not_refused(client):
    """Regression (0.4): "www.sito.it" in a vCard gave an unhelpful "controlla i campi" error."""
    signup(client)
    saved = create_page_qr(client, "vcard", vcard_page(website="www.example.com"))
    assert saved.status_code == 201, saved.text
    page = client.get(f"{qrs(client)}/{saved.json()['id']}/page").json()
    contact = next(b for b in page["blocks"] if b["type"] == "contact")
    assert contact["website"] == "https://www.example.com"


def test_validation_errors_carry_the_path_so_the_form_can_point_at_the_field(client):
    signup(client)
    bad = create_page_qr(client, "vcard", vcard_page(website="not a url"))
    assert bad.status_code == 422
    errors = bad.json()["errors"]
    assert any(e["field"] == "website" and e["path"].startswith("page.") for e in errors)
