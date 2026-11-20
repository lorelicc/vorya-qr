import copy

import pytest
from sqlalchemy import select, update

from app.models import LinkVersion, QrPage, Workspace
from app.schemas.page import ALLERGENS, Page
from tests.conftest import csrf, qrs, signup
from tests.test_pages_types import THEME, create_page_qr
from tests.test_redirect import follow

MENU = {
    "template": "menu",
    "theme": THEME,
    "settings": {"languages": ["it", "en"]},
    "blocks": [
        {"id": "h", "type": "header", "title": "Trattoria del Borgo"},
        {
            "id": "m",
            "type": "menu",
            "currency": "EUR",
            "intro": {"it": "Prodotti del territorio", "en": "Local produce"},
            "sections": [
                {
                    "id": "s1", "kind": "food", "title": {"it": "Antipasti", "en": "Starters"},
                    "items": [{
                        "id": "i1", "name": {"it": "Tagliere", "en": "Board"},
                        "description": {"it": "Salumi e formaggi", "en": ""}, "price": "14,5",
                        "allergens": ["milk", "sulphites"], "badges": ["recommended"],
                    }],
                },
                {
                    "id": "s2", "kind": "wine", "title": {"it": "Rossi", "en": "Red wines"},
                    "items": [{
                        "id": "w1", "name": {"it": "Nebbiolo Riserva"}, "allergens": ["sulphites"],
                        "wine": {"producer": "Cantina Rossi", "appellation": "DOCG",
                                 "denomination": "Barolo", "vintage": 2019, "grapes": ["Nebbiolo"],
                                 "area": "Langhe", "price_glass": "9", "price_bottle": "58,00"},
                    }],
                },
            ],
        },
    ],
}  # fmt: skip


def test_the_fourteen_allergens_of_the_regulation():
    assert len(ALLERGENS) == 14 and "sulphites" in ALLERGENS and "lupin" in ALLERGENS


def test_schema_normalises_prices_and_rejects_bad_content():
    page = Page.model_validate(MENU)
    item = page.blocks[1].sections[0].items[0]
    assert item.price == "14.50" and item.allergens == ["milk", "sulphites"]
    wine = page.blocks[1].sections[1].items[0].wine
    assert (wine.price_glass, wine.price_bottle) == ("9.00", "58.00")
    bad = copy.deepcopy(MENU)
    bad["blocks"][1]["sections"][0]["items"][0]["allergens"] = ["peanut-butter"]
    with pytest.raises(ValueError):
        Page.model_validate(bad)
    bad = copy.deepcopy(MENU)
    bad["blocks"][1]["sections"][0]["items"][0]["price"] = "caro"
    with pytest.raises(ValueError):
        Page.model_validate(bad)
    bad = copy.deepcopy(MENU)
    bad["blocks"][1]["sections"][0]["items"][0]["name"]["it"] = " "
    with pytest.raises(ValueError):
        Page.model_validate(bad)
    twin = copy.deepcopy(MENU)
    twin["blocks"][1]["sections"][1]["items"][0]["id"] = "i1"
    with pytest.raises(ValueError):
        Page.model_validate(twin)
    only_header = {"template": "menu", "theme": THEME, "blocks": [MENU["blocks"][0]]}
    with pytest.raises(ValueError):
        Page.model_validate(only_header)


def test_menu_is_created_served_publicly_with_both_languages(client):
    signup(client)  # trial = Pro: menu included
    response = create_page_qr(client, "menu", MENU)
    assert response.status_code == 201, response.text
    qr = response.json()
    assert qr["qr_type"] == "menu" and qr["destination"] == "page"
    assert follow(client, qr["slug"]).headers["x-vorya-destination"] == "page"
    public = client.get(f"/api/public/pages/{qr['slug']}").json()["page"]
    assert public["settings"]["languages"] == ["it", "en"]
    section = public["blocks"][1]["sections"][0]
    assert section["title"] == {"it": "Antipasti", "en": "Starters"}
    assert section["items"][0]["description"]["en"] == ""  # the page falls back to Italian


def test_menu_type_is_a_plan_feature(client, db):
    signup(client)
    db.execute(update(Workspace).values(plan_id="free", trial_ends_at=None))
    db.commit()
    locked = create_page_qr(client, "menu", MENU)
    assert locked.status_code == 403 and locked.json()["code"] == "feature_locked"
    plan = client.get("/api/account/plan").json()
    assert "menu" not in plan["features"]["allowed_types"]


def test_quick_edit_updates_the_live_page_without_a_new_version(client, db):
    signup(client)
    qr = create_page_qr(client, "menu", MENU).json()
    url = f"{qrs(client)}/{qr['id']}/menu/items"
    off = client.patch(f"{url}/i1", json={"sold_out": True, "price": "15"}, headers=csrf(client))
    assert off.status_code == 200 and off.json() == {"id": "i1", "sold_out": True, "price": "15.00"}
    wine = client.patch(f"{url}/w1", json={"price_glass": "10,5"}, headers=csrf(client))
    assert wine.status_code == 200
    doc = db.scalar(select(QrPage.document).where(QrPage.qr_code_id == qr["id"]))
    items = {i["id"]: i for s in doc["blocks"][1]["sections"] for i in s["items"]}
    assert items["i1"]["sold_out"] is True and items["w1"]["wine"]["price_glass"] == "10.50"
    versions = db.scalars(select(LinkVersion).where(LinkVersion.qr_code_id == qr["id"])).all()
    assert len(versions) == 1  # edited in place
    assert versions[0].page["blocks"][1]["sections"][0]["items"][0]["sold_out"] is True
    public = client.get(f"/api/public/pages/{qr['slug']}").json()["page"]
    assert public["blocks"][1]["sections"][0]["items"][0]["sold_out"] is True
    assert (
        client.patch(f"{url}/zzz", json={"sold_out": True}, headers=csrf(client)).status_code == 404
    )
    bad = client.patch(f"{url}/i1", json={"price": "caro"}, headers=csrf(client))
    assert bad.status_code == 422


def test_quick_edit_is_scoped_to_menus_of_the_company(client):
    signup(client)
    other = create_page_qr(client, "link_in_bio", {
        "template": "link_in_bio", "theme": THEME,
        "blocks": [{"id": "l", "type": "link_list", "items": []}]}).json()  # fmt: skip
    r = client.patch(f"{qrs(client)}/{other['id']}/menu/items/i1", json={"sold_out": True},
                     headers=csrf(client))  # fmt: skip
    assert r.status_code == 404
