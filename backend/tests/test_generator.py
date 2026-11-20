"""Free public generator: no account, no persistence, strict limits; and the handoff to dynamic."""

import base64
import io

from PIL import Image
from sqlalchemy import func, select

from app.models import GeneratorCounter, PlatformSetting, QrCode, StoredFile, Workspace
from tests.conftest import ORIGIN, PASSWORD, last_mail, token_from

URL = "/api/public/generator"
SITE = {"type": "website", "data": {"url": "https://example.com/promo"}}


def png_data_url(size=(64, 64), color="#087f5b") -> str:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, "PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def test_preview_renders_and_checks_scannability_without_an_account(client, db):
    response = client.post(f"{URL}/preview", json=SITE)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["svg"].startswith("<svg") and body["content"] == "https://example.com/promo"
    assert body["scannability"]["scannable"] is True and body["static"] is True


def test_nothing_is_persisted_except_anonymous_counters(client, db):
    client.post(f"{URL}/preview", json={**SITE, "landing": "/qr-code/sito-web"})
    client.post(f"{URL}/download", json={**SITE, "format": "svg"})
    assert db.scalar(select(func.count()).select_from(QrCode)) == 0
    assert db.scalar(select(func.count()).select_from(StoredFile)) == 0
    rows = {(c.event, c.qr_type, c.landing): c.count for c in db.scalars(select(GeneratorCounter))}
    assert rows[("preview", "website", "/qr-code/sito-web")] == 1
    assert rows[("download", "website", "/genera")] == 1


def test_download_png_and_svg_without_watermark(client):
    png = client.post(f"{URL}/download", json={**SITE, "format": "png", "size": 512})
    assert png.status_code == 200 and png.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert Image.open(io.BytesIO(png.content)).size == (512, 512)
    assert "attachment" in png.headers["content-disposition"]
    svg = client.post(f"{URL}/download", json={**SITE, "format": "svg"})
    assert svg.headers["content-type"].startswith("image/svg+xml") and b"<svg" in svg.content


def test_every_static_type_including_the_static_vcard(client):
    cases = {
        "text": {"text": "Ciao"},
        "wifi": {"ssid": "Casa", "password": "segreta12", "encryption": "WPA"},
        "email": {"to": "a@example.com", "subject": "Hi"},
        "sms": {"number": "+39 333 1234567", "message": "ok"},
        "phone": {"number": "+39 333 1234567"},
        "whatsapp": {"number": "+39 333 1234567"},
        "vcard_static": {"first_name": "Giulia", "last_name": "Bianchi", "phone": "+39 333 1234567",
                         "email": "g@example.com", "website": "www.example.com"},
    }  # fmt: skip
    for kind, data in cases.items():
        response = client.post(f"{URL}/preview", json={"type": kind, "data": data})
        assert response.status_code == 200, (kind, response.text)
        assert response.json()["scannability"]["scannable"], kind
    vcard = client.post(
        f"{URL}/preview", json={"type": "vcard_static", "data": cases["vcard_static"]}
    )
    content = vcard.json()["content"]
    assert content.startswith("BEGIN:VCARD") and "FN:Giulia Bianchi" in content
    assert "URL:https://www.example.com" in content  # completed, not refused


def test_invalid_content_and_unknown_types_are_rejected(client):
    bad = client.post(f"{URL}/preview", json={"type": "website", "data": {"url": "ciao"}})
    assert bad.status_code == 422 and bad.json()["code"] == "invalid_content"
    assert client.post(f"{URL}/preview", json={"type": "pdf", "data": {}}).status_code == 422
    assert client.post(f"{URL}/preview", json={"type": "website", "data": {}}).status_code == 422


def test_honeypot_and_size_limits(client):
    assert client.post(f"{URL}/preview", json={**SITE, "hp": "http://spam"}).status_code == 400
    huge = {**SITE, "logo": "data:image/png;base64," + "A" * 600_000}
    assert client.post(f"{URL}/preview", json=huge).status_code in (413, 422)


def test_logo_lives_in_memory_only_and_is_validated(client, db):
    ok = client.post(f"{URL}/preview", json={**SITE, "logo": png_data_url(),
                                             "design": {"logo": {"file_id": "x" * 36}}})  # fmt: skip
    assert ok.status_code in (200, 422)  # the placeholder id is overridden: bad ids are ignored
    plain = client.post(f"{URL}/preview", json={**SITE, "logo": png_data_url()})
    assert plain.status_code == 200 and "<image" in plain.json()["svg"]
    assert db.scalar(select(func.count()).select_from(StoredFile)) == 0
    for bad in ("data:text/html;base64,PGI+", "data:image/png;base64,@@@", "nonsense"):
        r = client.post(f"{URL}/preview", json={**SITE, "logo": bad})
        assert r.status_code == 422 and r.json()["code"] == "bad_logo"
    big = "data:image/png;base64," + base64.b64encode(b"\x00" * (300 * 1024)).decode()
    assert client.post(f"{URL}/preview", json={**SITE, "logo": big}).status_code in (413, 422)
    notimg = "data:image/png;base64," + base64.b64encode(b"not an image").decode()
    assert client.post(f"{URL}/preview", json={**SITE, "logo": notimg}).status_code == 422


def test_strict_rate_limit_per_ip(client):
    codes = [
        client.post(f"{URL}/download", json={**SITE, "format": "svg"}).status_code
        for _ in range(32)
    ]
    assert codes[:30] == [200] * 30 and codes[30:] == [429, 429]


def test_track_counts_a_view_and_sanitises_the_landing(client, db):
    assert (
        client.post(
            f"{URL}/track", json={"event": "view", "type": "wifi", "landing": "/genera"}
        ).status_code
        == 204
    )
    client.post(f"{URL}/track", json={"event": "view", "landing": "/<script>"})
    rows = {(c.qr_type, c.landing): c.count for c in db.scalars(select(GeneratorCounter))}
    assert rows[("wifi", "/genera")] == 1 and rows[("", "/")] == 1


def test_public_counters_only_above_the_threshold_and_from_real_data(client, db):
    assert client.get("/api/public/site/counters").json()["qr_created"] is None
    client.post(f"{URL}/download", json={**SITE, "format": "svg"})
    db.merge(PlatformSetting(key="site", data={"counter_threshold": 1}))
    db.commit()
    assert client.get("/api/public/site/counters").json()["qr_created"] == 1
    db.delete(db.get(PlatformSetting, "site"))
    db.commit()


# ---------------------------------------------------------------- handoff to a dynamic QR


def register_with(client, email, **extra):
    r = client.post("/api/auth/register", json={"email": email, "display_name": "Mario Rossi",
                                                "workspace_name": "Pizzeria", "accept_terms": True,
                                                **extra}, headers={"Origin": ORIGIN})  # fmt: skip
    assert r.status_code == 202, r.text
    token = token_from(last_mail("verify", email))
    return client.post("/api/auth/verify-email", json={"token": token, "password": PASSWORD,
                                                       "confirm_password": PASSWORD},
                       headers={"Origin": ORIGIN})  # fmt: skip


def test_handoff_creates_the_dynamic_qr_with_the_same_style_and_saves_attribution(client, db):
    design = {"modules": "dots", "fill": {"type": "solid", "color": "#087f5b"}}
    done = register_with(
        client, "gen@example.com",
        handoff={"type": "website", "data": {"url": "https://example.com/menu"}, "design": design},
        attribution={"utm_source": "google", "utm_medium": "cpc", "landing": "/genera", "generator": "website"},
    )  # fmt: skip
    assert done.status_code == 200
    qr = db.scalars(select(QrCode)).one()
    assert (qr.kind, qr.qr_type, qr.target_url) == (
        "dynamic",
        "website",
        "https://example.com/menu",
    )
    assert qr.design["modules"] == "dots" and qr.design["fill"]["color"] == "#087f5b"
    assert db.scalars(select(Workspace)).one().attribution["utm_source"] == "google"


def test_vcard_handoff_creates_a_hosted_vcard(client, db):
    data = {"first_name": "Giulia", "last_name": "Bianchi", "phone": "+39 333 1234567",
            "email": "g@example.com"}  # fmt: skip
    assert (
        register_with(
            client, "v@example.com", handoff={"type": "vcard_static", "data": data}
        ).status_code
        == 200
    )
    qr = db.scalars(select(QrCode)).one()
    assert (qr.qr_type, qr.destination, qr.name) == ("vcard", "page", "Giulia Bianchi")


def test_a_broken_handoff_never_breaks_the_signup(client, db):
    done = register_with(
        client, "b@example.com", handoff={"type": "website", "data": {"url": "not a url"}}
    )
    assert done.status_code == 200
    assert db.scalar(select(func.count()).select_from(QrCode)) == 0


# ---------------------------------------------------------------- contact form


def contact(client, **over):
    body = {"name": "Mario Rossi", "email": "mario@example.com",
            "message": "Vorrei informazioni sui piani.", "accept_privacy": True, **over}  # fmt: skip
    return client.post("/api/public/contact", json=body)


def test_contact_form_sends_to_support_with_reply_to_and_rate_limits(client):
    import json
    from pathlib import Path

    from tests.conftest import MAIL_DIR

    assert contact(client).status_code == 202
    sent = [json.loads(p.read_text()) for p in Path(MAIL_DIR).glob("contact-*.json")]
    assert (
        sent
        and sent[0]["to"] == "supporto@example.com"
        and "Vorrei informazioni" in sent[0]["text"]
    )
    assert contact(client, accept_privacy=False).status_code == 422
    for i in range(4):  # 5 per IP per hour in total
        assert contact(client, email=f"altro{i}@example.com").status_code == 202
    assert contact(client, email="altro9@example.com").status_code == 429


def test_contact_honeypot_pretends_success_and_sends_nothing(client):
    from pathlib import Path

    from tests.conftest import MAIL_DIR

    before = len(list(Path(MAIL_DIR).glob("contact-*.json")))
    assert contact(client, hp="http://spam").status_code == 202
    assert len(list(Path(MAIL_DIR).glob("contact-*.json"))) == before
