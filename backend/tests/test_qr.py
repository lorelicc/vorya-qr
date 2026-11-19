import struct

from app.qr.contrast import contrast_ratio, warnings
from app.qr.render import SLUG_ALPHABET, new_slug, render_png
from tests.conftest import csrf, qrs, signup

URL = "https://www.vorya.it/promo"


def create(client, kind="dynamic", **extra):
    payload = {"name": f"QR {kind}", "qr_type": "website", "dynamic": kind == "dynamic",
               "target_url": URL, **extra}  # fmt: skip
    return client.post(f"{qrs(client)}", json=payload, headers=csrf(client))


def test_create_dynamic_qr_with_slug_and_short_url(client):
    signup(client)
    response = create(client)
    assert response.status_code == 201, response.text
    qr = response.json()
    assert len(qr["slug"]) == 7 and set(qr["slug"]) <= set(SLUG_ALPHABET)
    assert qr["short_url"] == f"http://testserver/r/{qr['slug']}"
    assert qr["error_correction"] == "M"
    assert qr["status"] == "active"


def test_create_static_qr_has_no_slug(client):
    signup(client)
    qr = create(client, kind="static").json()
    assert qr["slug"] is None and qr["short_url"] is None


def test_url_validation(client):
    signup(client)
    for bad in ("ftp://example.com", "www.example.com", "https://exa mple.com", "javascript:1"):
        assert create(client, target_url=bad).status_code == 422
    loop = create(client, target_url="http://testserver/r/abcdefg")
    assert loop.status_code == 422


def test_list_search_and_filters(client):
    signup(client)
    create(client, name="Menu ristorante")
    create(client, kind="static", name="Biglietto da visita")
    assert len(client.get(f"{qrs(client)}").json()) == 2
    assert [q["name"] for q in client.get(f"{qrs(client)}?search=menu").json()] == [
        "Menu ristorante"
    ]
    assert len(client.get(f"{qrs(client)}?kind=static").json()) == 1
    assert client.get(f"{qrs(client)}?kind=altro").status_code == 422


def test_update_destination_pause_resume_delete(client):
    signup(client)
    qr = create(client).json()
    body = {"name": "Nuovo nome", "target_url": "https://example.com/nuova"}
    updated = client.put(f"{qrs(client)}/{qr['id']}", json=body, headers=csrf(client)).json()
    assert updated["target_url"] == "https://example.com/nuova"
    assert updated["slug"] == qr["slug"]
    paused = client.post(f"{qrs(client)}/{qr['id']}/pause", headers=csrf(client)).json()
    assert paused["status"] == "paused"
    resumed = client.post(f"{qrs(client)}/{qr['id']}/resume", headers=csrf(client)).json()
    assert resumed["status"] == "active"
    assert client.delete(f"{qrs(client)}/{qr['id']}", headers=csrf(client)).status_code == 204
    assert client.get(f"{qrs(client)}/{qr['id']}").status_code == 404


def test_static_qr_cannot_be_paused(client):
    signup(client)
    qr = create(client, kind="static").json()
    assert client.post(f"{qrs(client)}/{qr['id']}/pause", headers=csrf(client)).status_code == 409


def test_workspaces_are_isolated(client):
    signup(client, "a@example.com")
    qr = create(client).json()
    client.cookies.clear()
    signup(client, "b@example.com")
    assert client.get(f"{qrs(client)}/{qr['id']}").status_code == 404
    assert client.get(f"{qrs(client)}").json() == []
    response = client.delete(f"{qrs(client)}/{qr['id']}", headers=csrf(client))
    assert response.status_code == 404


def test_preview_returns_svg_and_warnings(client):
    signup(client)
    body = {
        "qr_type": "website",
        "dynamic": False,
        "target_url": URL,
        "fg_color": "#eeeeee",
        "bg_color": "#ffffff",
        "margin": 1,
        "error_correction": "M",
    }
    data = client.post(f"{qrs(client)}/preview", json=body, headers=csrf(client)).json()
    assert data["svg"].startswith("<svg")
    assert {w["code"] for w in data["warnings"]} == {"low_contrast", "small_margin"}
    body.update(fg_color="#ffffff", bg_color="#091411", margin=4)
    data = client.post(f"{qrs(client)}/preview", json=body, headers=csrf(client)).json()
    assert [w["code"] for w in data["warnings"]] == ["inverted"]


def test_download_png_and_svg(client):
    signup(client)
    qr = create(client, name="Menù Estate", fg_color="#087f5b").json()
    png = client.get(f"{qrs(client)}/{qr['id']}/image.png?size=512")
    assert png.status_code == 200 and png.headers["content-type"] == "image/png"
    assert png.content[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = struct.unpack(">II", png.content[16:24])
    assert width == height == int(png.headers["x-image-size"]) and 400 < width <= 512
    assert 'filename="vorya-qr-menu-estate.png"' in png.headers["content-disposition"]
    svg = client.get(f"{qrs(client)}/{qr['id']}/image.svg")
    assert svg.headers["content-type"].startswith("image/svg+xml")
    assert "#087f5b" in svg.text
    assert client.get(f"{qrs(client)}/{qr['id']}/image.png?size=99999").status_code == 422


def test_render_png_scales_to_requested_size():
    png, size = render_png(
        URL, fg="#000000", bg="#ffffff", margin=4, error_correction="M", size=1024
    )
    assert struct.unpack(">II", png[16:24]) == (size, size)
    assert size <= 1024


def test_contrast_rules():
    assert round(contrast_ratio("#000000", "#ffffff"), 1) == 21.0
    assert warnings("#091411", "#ffffff", 4) == []


def test_slugs_are_random():
    assert len({new_slug() for _ in range(200)}) == 200
