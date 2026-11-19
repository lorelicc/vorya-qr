import csv
import io
import zipfile

from sqlalchemy import select, update

from app.models import Folder, ImportJob, LinkAlias, LinkTag, Plan, QrCode, QrPage, Tag, Workspace
from app.worker import run_queue
from tests.conftest import csrf, qrs, signup

HEADER = "nome;tipo;destinazione;campi;back_half;cartella;tag;stile;utm_source;utm_medium"


def base(client):
    return qrs(client).replace("/qr-codes", "/imports")


def upload(client, content: str | bytes, fmt="png"):
    data = content.encode("utf-8") if isinstance(content, str) else content
    return client.post(base(client), files={"file": ("import.csv", data, "text/csv")},
                       data={"format": fmt}, headers=csrf(client))  # fmt: skip


def table(*rows: str, header=HEADER) -> str:
    return "\n".join([header, *rows]) + "\n"


GOOD = table(
    "Menu estate;url;https://example.com/menu;;menu-estate;Eventi/2026;estate|promo;;qr;stampa",
    "Promo;link;https://example.com/promo;;;;promo;;;",
    "Giulia;vcard;;nome=Giulia|cognome=Bianchi|telefono=+39 333 1234567|email=g@example.com;;;;;;",
    "Wifi sala;wifi;;ssid=Cantina|password=benvenuti2026|sicurezza=WPA;;;;;;",
)


def test_template_is_valid_for_the_import_itself(client):
    signup(client)
    template = client.get(f"{base(client)}/template.csv")
    assert template.status_code == 200 and template.content.startswith(b"\xef\xbb\xbf")
    job = upload(client, template.content)
    assert job.status_code == 201 and job.json()["status"] == "validated", job.json()["errors"]


def test_preview_reports_errors_row_by_row_and_creates_nothing(client, db):
    signup(client)
    bad = table(
        "ok;url;https://example.com/a;;;;;;;",
        "senza tipo valido;boh;https://example.com/b;;;;;;;",
        "url rotto;url;non-un-url;;;;;;;",
        "login;url;https://example.com/c;;login;;;;;",
        "stile;url;https://example.com/d;;;;;Inesistente;;",
        "utm;url;https://example.com/e?utm_source=x;;;;;;y;",
        "wifi;wifi;;ssid=;;;;;;",
        "cartella;url;https://example.com/f;;;A/B/C;;;;",
    )
    job = upload(client, bad).json()
    assert job["status"] == "invalid"
    where = {(e["row"], e["column"]) for e in job["errors"]}
    assert {(3, "tipo"), (4, "destinazione"), (5, "back_half"), (6, "stile"), (7, "destinazione"),
            (8, "campi"), (9, "cartella")} <= where  # fmt: skip
    assert (2, "tipo") not in where  # the good row is not flagged
    assert db.query(QrCode).count() == 0
    confirm = client.post(f"{base(client)}/{job['id']}/confirm", headers=csrf(client))
    assert confirm.status_code == 409 and confirm.json()["code"] == "not_confirmable"


def test_separators_encodings_and_bom(client):
    signup(client)
    comma = "nome,tipo,destinazione\nUno,link,https://example.com/uno\nDue,link,https://example.com/due\n"
    assert upload(client, comma).json()["status"] == "validated"
    tabbed = comma.replace(",", "\t")
    assert upload(client, tabbed).json()["status"] == "validated"
    semicolon = "nome;tipo;destinazione\nPerché;link;https://example.com/p\n"
    assert upload(client, b"\xef\xbb\xbf" + semicolon.encode()).json()["status"] == "validated"
    legacy = upload(client, semicolon.encode("cp1252"))  # Excel "CSV" without UTF-8
    assert legacy.json()["status"] == "validated"
    assert upload(client, b"").status_code == 422
    assert upload(client, "nome;destinazione\nx;https://e.com\n").json()["code"] == "missing_column"


def test_confirm_creates_everything_atomically_and_worker_builds_the_zip(client, db):
    signup(client)
    job = upload(client, GOOD).json()
    assert job["status"] == "validated" and job["errors"] == [] and job["total"] == 4
    done = client.post(f"{base(client)}/{job['id']}/confirm", headers=csrf(client))
    assert done.status_code == 200 and done.json()["status"] == "queued"

    links = list(db.scalars(select(QrCode).order_by(QrCode.id)))
    assert [(q.name, q.kind, q.has_qr) for q in links] == [
        ("Menu estate", "dynamic", True), ("Promo", "dynamic", False),
        ("Giulia", "dynamic", True), ("Wifi sala", "static", True)]  # fmt: skip
    assert links[0].target_url == "https://example.com/menu?utm_source=qr&utm_medium=stampa"
    assert db.scalar(select(LinkAlias.alias)) == "menu-estate"
    assert {t.name for t in db.scalars(select(Tag))} == {"estate", "promo"}
    assert db.query(LinkTag).count() == 3
    folders = {f.name: f.parent_id for f in db.scalars(select(Folder))}
    assert folders["2026"] is not None and folders["Eventi"] is None
    assert db.scalar(select(QrPage.template)) == "vcard"
    assert client.get(f"/r/{links[0].slug}", follow_redirects=False).status_code == 302
    assert client.get("/r/menu-estate", follow_redirects=False).status_code == 302

    assert run_queue(db) == 1
    status = client.get(f"{base(client)}/{job['id']}").json()
    assert (status["status"], status["processed"], status["total"]) == ("done", 4, 4)
    result = client.get(f"{base(client)}/{job['id']}/result.zip")
    archive = zipfile.ZipFile(io.BytesIO(result.content))
    names = archive.namelist()
    assert sorted(n for n in names if n.endswith(".png")) == [
        "0001-menu-estate.png", "0003-giulia.png", "0004-wifi-sala.png"]  # fmt: skip
    assert archive.read("0001-menu-estate.png").startswith(b"\x89PNG")
    rows = list(
        csv.reader(io.StringIO(archive.read("riepilogo.csv").decode("utf-8-sig")), delimiter=";")
    )
    assert rows[0][:3] == ["riga", "nome", "tipo"] and len(rows) == 5
    assert rows[1][4].endswith("/menu-estate") and rows[2][6] == ""  # link only: no file


def test_quota_is_all_or_nothing_for_the_whole_batch(client, db):
    signup(client)
    plan = db.get(Plan, "pro")
    plan.max_dynamic_qr = 2
    db.commit()
    rows = [f"L{i};link;https://example.com/{i};;;;;;;" for i in range(5)]
    job = upload(client, table(*rows)).json()
    assert job["status"] == "invalid"
    message = next(e["message"] for e in job["errors"] if e["column"] == "quota")
    assert "3 righe superano il limite" in message and "Non è stato creato nulla" in message
    assert db.query(QrCode).count() == 0

    # Quota taken between preview and confirm: confirm fails and nothing is created.
    plan.max_dynamic_qr = 10
    db.commit()
    job = upload(client, table(*rows)).json()
    assert job["status"] == "validated"
    plan.max_dynamic_qr = 4
    db.commit()
    refused = client.post(f"{base(client)}/{job['id']}/confirm", headers=csrf(client))
    assert refused.status_code == 409 and refused.json()["code"] == "quota_import"
    assert db.query(QrCode).count() == 0


def test_plan_gates_rows_back_half_and_availability(client, db):
    signup(client)
    plan = db.get(Plan, "pro")
    plan.features = {**plan.features, "max_bulk_rows": 2}
    db.commit()
    big = upload(client, table(*[f"L{i};link;https://example.com/{i};;;;;;;" for i in range(3)]))
    assert big.status_code == 422 and big.json()["code"] == "too_many_rows"
    dup = upload(
        client,
        table("A;link;https://a.example;;stesso;;;;;", "B;link;https://b.example;;stesso;;;;;"),
    )
    assert {(e["row"], e["column"]) for e in dup.json()["errors"]} == {(3, "back_half")}

    db.execute(update(Workspace).values(plan_id="start", trial_ends_at=None))
    db.commit()
    locked = upload(client, GOOD)
    assert locked.status_code == 403 and locked.json()["code"] == "feature_locked"


def test_blocked_domains_and_isolation_between_companies(client, db):
    signup(client)
    from app.models import BlockedDomain

    db.add(BlockedDomain(domain="evil.example"))
    db.commit()
    job = upload(client, table("x;link;https://www.evil.example/p;;;;;;;")).json()
    assert job["status"] == "invalid" and job["errors"][0]["column"] == "destinazione"

    ok = upload(client, table("y;link;https://fine.example;;;;;;;")).json()
    other = client.post("/api/companies", json={"name": "Seconda"}, headers=csrf(client)).json()
    foreign = client.get(f"/api/companies/{other['id']}/imports/{ok['id']}")
    assert foreign.status_code == 404


def test_failed_render_can_be_retried(client, db, monkeypatch):
    signup(client)
    job = upload(client, table("a;url;https://example.com/a;;;;;;;")).json()
    client.post(f"{base(client)}/{job['id']}/confirm", headers=csrf(client))
    monkeypatch.setattr("app.imports.service.build_zip", lambda *a, **k: 1 / 0, raising=True)
    run_queue(db)
    assert client.get(f"{base(client)}/{job['id']}").json()["status"] == "failed"
    monkeypatch.undo()
    assert (
        client.post(f"{base(client)}/{job['id']}/retry", headers=csrf(client)).json()["status"]
        == "queued"
    )
    run_queue(db)
    assert client.get(f"{base(client)}/{job['id']}").json()["status"] == "done"
    assert db.get(ImportJob, job["id"]).total == 1


def test_export_csv_applies_filters_and_neutralises_formulas(client):
    signup(client)
    job = upload(client, table("=SUM(1);url;https://example.com/a;;;Eventi;vip;;;",
                               "Promo;link;https://example.com/b;;;;;;;")).json()  # fmt: skip
    client.post(f"{base(client)}/{job['id']}/confirm", headers=csrf(client))
    everything = client.get(f"{qrs(client)}/export.csv")
    assert everything.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(everything.content.decode("utf-8-sig")), delimiter=";"))
    assert len(rows) == 3 and rows[0][0] == "nome"
    names = {r[0] for r in rows[1:]}
    assert "'=SUM(1)" in names  # formula injection neutralised
    only_links = client.get(f"{qrs(client)}/export.csv?view=links")
    assert len(list(csv.reader(io.StringIO(only_links.text), delimiter=";"))) == 2
