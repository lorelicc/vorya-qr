import io
import itertools

import pytest
from PIL import Image

from app.qr.designer import render_svg, svg_to_png
from app.qr.scan_check import check, decode
from app.schemas.design import Fill, Logo, QrDesign
from tests.conftest import csrf, qrs, signup
from tests.test_files import upload

CONTENT = "https://qr.vorya.it/r/Ab3dEf7"
LOGO_ID = "0f8fad5b-d9cb-469f-a165-70867728950e"


def logo_png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", (256, 256), (0, 233, 154, 255)).save(buffer, "PNG")
    return buffer.getvalue()


STYLE_MATRIX = list(
    itertools.product(
        ["square", "rounded", "dots", "classy", "extra_rounded"],
        ["square", "rounded", "circle", "leaf", "extra_rounded"],
        ["square", "rounded", "circle", "leaf"],
        ["solid", "linear", "radial"],
    )
)


@pytest.mark.parametrize("modules,frame,ball,fill", STYLE_MATRIX)
def test_every_style_combination_decodes(modules, frame, ball, fill):
    design = QrDesign(modules=modules, eye_frame=frame, eye_ball=ball,
                      fill=Fill(type=fill, color="#091411", color2="#087f5b"))  # fmt: skip
    assert decode(render_svg(CONTENT, design)) == [CONTENT]


@pytest.mark.parametrize("modules", ["square", "rounded", "dots", "classy", "extra_rounded"])
@pytest.mark.parametrize("size", [0.18, 0.25, 0.3])
def test_logos_up_to_the_safe_limit_decode(modules, size):
    design = QrDesign(modules=modules, logo=Logo(file_id=LOGO_ID, size=size, padding=0))
    assert design.error_correction == "H"  # forced by the logo
    assert decode(render_svg(CONTENT, design, logo_png())) == [CONTENT]


def test_unreadable_designs_are_explained():
    pale = QrDesign(fill=Fill(color="#e6e6e6"))
    result = check(CONTENT, pale, render_svg(CONTENT, pale))
    assert not result["scannable"]
    # zxing reads even this perfect digital render, but no phone would on a print: blocked.
    assert {r["code"]: r["blocking"] for r in result["reasons"]} == {"low_contrast": True}
    inverted = QrDesign(fill=Fill(color="#ffffff"), background="#091411")
    result = check(CONTENT, inverted, render_svg(CONTENT, inverted))
    assert not result["scannable"] and "inverted" in {r["code"] for r in result["reasons"]}


def test_transparent_background_is_flagged_but_scannable():
    design = QrDesign(transparent=True)
    svg = render_svg(CONTENT, design)
    assert "<rect width" not in svg.split("</defs>")[-1][:200] or 'fill="#ffffff"' not in svg[:300]
    result = check(CONTENT, design, svg)
    assert result["scannable"] and result["reasons"][-1]["code"] == "transparent"
    png = Image.open(io.BytesIO(svg_to_png(svg, 256)))
    assert png.mode == "RGBA" and png.getpixel((1, 1))[3] == 0


def create_designed(client, design, **extra):
    body = {"name": "Stile", "qr_type": "website", "target_url": "https://example.com",
            "design": design, **extra}  # fmt: skip
    return client.post(qrs(client), json=body, headers=csrf(client))


def test_save_is_blocked_when_the_qr_does_not_decode(client):
    signup(client)
    response = create_designed(client, {"fill": {"color": "#eeeeee"}})
    assert response.status_code == 422 and response.json()["code"] == "unscannable"
    assert response.json()["errors"][0]["field"] == "design"
    ok = create_designed(client, {"modules": "dots", "eye_frame": "circle", "fill": {
        "type": "linear", "color": "#087f5b", "color2": "#091411", "angle": 90}})  # fmt: skip
    assert ok.status_code == 201
    assert ok.json()["design"]["modules"] == "dots" and ok.json()["fg_color"] == "#087f5b"


def test_preview_reports_scannability(client):
    signup(client)
    body = {"qr_type": "website", "target_url": "https://example.com",
            "design": {"fill": {"color": "#ffffff"}, "background": "#091411"}}  # fmt: skip
    data = client.post(f"{qrs(client)}/preview", json=body, headers=csrf(client)).json()
    assert data["scannability"]["scannable"] is False
    assert data["svg"].startswith("<svg")


def test_exports_png_exact_size_svg_and_vector_pdf(client):
    signup(client)
    qr = create_designed(client, {"modules": "rounded"}).json()
    png = client.get(f"{qrs(client)}/{qr['id']}/image.png?size=777")
    assert Image.open(io.BytesIO(png.content)).size == (777, 777)
    pdf = client.get(f"{qrs(client)}/{qr['id']}/image.pdf")
    assert pdf.headers["content-type"] == "application/pdf" and pdf.content.startswith(b"%PDF-")
    assert b"/Image" not in pdf.content  # modules are vector paths, not a bitmap
    svg = client.get(f"{qrs(client)}/{qr['id']}/image.svg")
    assert decode(svg.text) == [qr["short_url"]]


def test_logo_from_company_files(client):
    signup(client)
    png = io.BytesIO()
    Image.new("RGBA", (400, 400), (0, 233, 154, 255)).save(png, "PNG")
    logo = upload(client, png.getvalue(), "logo", "logo.png").json()
    qr = create_designed(
        client, {"error_correction": "L", "logo": {"file_id": logo["id"], "size": 0.25}}
    )
    assert qr.status_code == 201 and qr.json()["error_correction"] == "H"
    foreign = create_designed(client, {"logo": {"file_id": LOGO_ID}})
    assert foreign.status_code == 422
    too_big = create_designed(client, {"logo": {"file_id": logo["id"], "size": 0.5}})
    assert too_big.status_code == 422


def test_style_presets_limit_and_apply(client, db):
    from app.models import Plan

    signup(client)
    plan = db.get(Plan, "pro")
    plan.features = {**plan.features, "max_style_presets": 1}
    db.commit()
    styles = qrs(client).replace("/qr-codes", "/styles")
    first = client.post(
        styles, json={"name": "Brand", "design": {"modules": "dots"}}, headers=csrf(client)
    )
    assert first.status_code == 201
    second = client.post(styles, json={"name": "Altro", "design": {}}, headers=csrf(client))
    assert second.status_code == 409 and second.json()["code"] == "quota_styles"
    qr = create_designed(client, {}).json()
    body = {"style_id": first.json()["id"]}
    applied = client.post(f"{qrs(client)}/{qr['id']}/apply-style", json=body, headers=csrf(client))
    assert applied.status_code == 200 and applied.json()["design"]["modules"] == "dots"
    assert client.delete(f"{styles}/{first.json()['id']}", headers=csrf(client)).status_code == 204
