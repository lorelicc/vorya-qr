"""CSV import: decoding, column mapping and row-by-row validation.

The file is never trusted: encoding and separator are detected, columns are matched by name
(accents and case ignored), every row is validated with the same rules as the editor, and
nothing is created until the whole file is error-free and confirmed.
"""

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..abuse.checks import blocked_domains_of, host_blocked
from ..core.errors import CodedError
from ..links.service import alias_problem, normalise_alias
from ..models import StylePreset
from ..plans import TYPE_LABELS, features_of
from ..schemas.page import Page
from ..schemas.qr import valid_url

MAX_BYTES = 2 * 1024 * 1024
UTM_KEYS = ("source", "medium", "campaign", "term", "content")

COLUMNS = {
    "name": {"nome", "name", "titolo"},
    "type": {"tipo", "type"},
    "destination": {"destinazione", "destination", "url", "link", "indirizzo"},
    "fields": {"campi", "fields", "dati"},
    "back_half": {"back_half", "backhalf", "alias", "back_half_personalizzato"},
    "folder": {"cartella", "folder"},
    "tags": {"tag", "tags", "etichette"},
    "style": {"stile", "style", "preset", "preset_di_stile"},
    **{f"utm_{k}": {f"utm_{k}"} for k in UTM_KEYS},
}

# type column value -> (qr_type, kind, has_qr)
TYPES = {
    "link": ("website", "dynamic", False), "link_breve": ("website", "dynamic", False),
    "url": ("website", "dynamic", True), "sito": ("website", "dynamic", True),
    "sito_web": ("website", "dynamic", True), "qr_dinamico": ("website", "dynamic", True),
    "dinamico": ("website", "dynamic", True),
    "url_statico": ("website", "static", True), "statico": ("website", "static", True),
    "qr_statico": ("website", "static", True),
    "vcard": ("vcard", "dynamic", True),
    "wifi": ("wifi", "static", True), "wi_fi": ("wifi", "static", True),
    "testo": ("text", "static", True), "text": ("text", "static", True),
    "email": ("email", "static", True), "sms": ("sms", "static", True),
    "telefono": ("phone", "static", True), "phone": ("phone", "static", True),
    "whatsapp": ("whatsapp", "static", True),
}  # fmt: skip

# Field names accepted inside the `campi` column, per type (Italian and English).
FIELD_MAP = {
    "wifi": {"ssid": "ssid", "rete": "ssid", "password": "password", "sicurezza": "encryption",
             "encryption": "encryption", "nascosta": "hidden", "hidden": "hidden"},
    "text": {"testo": "text", "text": "text"},
    "email": {"a": "to", "to": "to", "email": "to", "oggetto": "subject", "subject": "subject",
              "corpo": "body", "body": "body"},
    "sms": {"numero": "number", "number": "number", "messaggio": "message", "message": "message"},
    "phone": {"numero": "number", "number": "number"},
    "whatsapp": {"numero": "number", "number": "number", "messaggio": "message",
                 "message": "message"},
    "vcard": {"nome": "first_name", "cognome": "last_name", "azienda": "organization",
              "ruolo": "job_title", "telefono": "phone", "cellulare": "phone", "email": "email",
              "sito": "website", "note": "note", "indirizzo": "street", "citta": "city",
              "cap": "postal_code", "paese": "country"},
}  # fmt: skip

TEMPLATE_HEADER = [
    "nome", "tipo", "destinazione", "campi", "back_half", "cartella", "tag", "stile",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
]  # fmt: skip
TEMPLATE_ROWS = [
    ["Menu estate", "url", "https://example.com/menu", "", "menu-estate", "Ristorante/2026", "estate|promo", "", "qr", "stampa", "estate-2026", "", ""],
    ["Promo newsletter", "link", "https://example.com/promo", "", "", "", "promo", "", "newsletter", "email", "", "", ""],
    ["Biglietto Giulia", "vcard", "", "nome=Giulia|cognome=Bianchi|azienda=Cantina Rossi|telefono=+39 333 1234567|email=giulia@example.com", "", "", "", "", "", "", "", "", ""],
    ["Wi-Fi sala", "wifi", "", "ssid=Cantina|password=benvenuti2026|sicurezza=WPA", "", "", "", "", "", "", "", "", ""],
]  # fmt: skip


def slug(value: str) -> str:
    """Lower-case ASCII with single underscores: matches headers and type names."""
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def decode(raw: bytes) -> str:
    if len(raw) > MAX_BYTES:
        raise CodedError(413, "Il file supera i 2 MB.", "too_large")
    for encoding in ("utf-8-sig", "cp1252"):  # UTF-8 with or without BOM, then Excel legacy
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise CodedError(422, "Impossibile leggere il file: salvalo in UTF-8.", "encoding")


def detect_delimiter(text: str) -> str:
    """The Italian Excel exports ';' and the rest of the world ','. Count on the header."""
    header = text.lstrip().splitlines()[0] if text.strip() else ""
    counts = {d: header.count(d) for d in (";", ",", "\t")}
    best = max(counts, key=counts.get)
    return best if counts[best] else ";"


def read_table(raw: bytes) -> tuple[list[str], list[list[str]], str]:
    text = decode(raw)
    delimiter = detect_delimiter(text)
    rows = [
        r for r in csv.reader(io.StringIO(text), delimiter=delimiter) if any(c.strip() for c in r)
    ]
    if not rows:
        raise CodedError(422, "Il file è vuoto.", "empty")
    return rows[0], rows[1:], delimiter


def map_columns(header: list[str]) -> dict[str, int]:
    found: dict[str, int] = {}
    for index, title in enumerate(header):
        key = slug(title)
        for column, names in COLUMNS.items():
            if key in names and column not in found:
                found[column] = index
    return found


@dataclass
class Context:
    """What validation needs from the database, loaded once for the whole file."""

    session: Session
    workspace: object
    company: object
    plan: object
    allowed_types: list[str]
    styles: dict[str, StylePreset]
    blocked: list[str]
    seen_aliases: set[str] = field(default_factory=set)


def build_context(session: Session, workspace, company, plan) -> Context:
    styles = {
        slug(s.name): s
        for s in session.scalars(select(StylePreset).where(StylePreset.company_id == company.id))
    }
    return Context(
        session=session, workspace=workspace, company=company, plan=plan,
        allowed_types=features_of(plan).allowed_types, styles=styles,
        blocked=blocked_domains_of(session),
    )  # fmt: skip


def parse_fields(value: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for part in value.split("|"):
        if not part.strip():
            continue
        if "=" not in part:
            raise ValueError(f"Campo «{part.strip()}» senza «=» (usa chiave=valore)")
        key, _, val = part.partition("=")
        out[slug(key)] = val.strip()
    return out


def with_utm(url: str, utm: dict[str, str]) -> str:
    parts = urlsplit(url)
    pairs = parse_qsl(parts.query, keep_blank_values=True)
    present = {k.lower() for k, _ in pairs}
    for key, value in utm.items():
        if not value:
            continue
        if f"utm_{key}" in present:
            raise ValueError(f"utm_{key} è già presente nell'URL")
        pairs.append((f"utm_{key}", value))
    return urlunsplit(parts._replace(query=urlencode(pairs)))


def vcard_page(data: dict[str, str], company) -> dict:
    name = " ".join(p for p in (data.get("first_name"), data.get("last_name")) if p)
    contact = {
        "id": "contact", "type": "contact",
        "first_name": data.get("first_name", ""), "last_name": data.get("last_name", ""),
        "organization": data.get("organization", ""), "job_title": data.get("job_title", ""),
        "phones": [{"label": "cell", "number": data["phone"]}] if data.get("phone") else [],
        "emails": [{"label": "work", "address": data["email"]}] if data.get("email") else [],
        "website": data.get("website", ""), "note": data.get("note", ""),
        "address": {"street": data.get("street", ""), "city": data.get("city", ""),
                    "postal_code": data.get("postal_code", ""), "country": data.get("country", "")},
    }  # fmt: skip
    header = {"id": "header", "type": "header", "title": name or data.get("organization", ""),
              "subtitle": data.get("job_title", "") or company.name}  # fmt: skip
    theme = {"primary": company.primary_color, "secondary": company.secondary_color}
    page = Page.model_validate({"template": "vcard", "theme": theme, "blocks": [header, contact]})
    return page.model_dump(mode="json")


def validate_row(
    ctx: Context, number: int, cells: dict[str, str]
) -> tuple[dict | None, list[dict]]:
    """-> (normalized row, errors). Errors carry the column they belong to."""
    errors: list[dict] = []

    def fail(column: str, message: str) -> None:
        errors.append({"row": number, "column": column, "message": message})

    kind_key = slug(cells.get("type", ""))
    if kind_key not in TYPES:
        fail("tipo", f"Tipo «{cells.get('type', '')}» non riconosciuto.")
        return None, errors
    qr_type, kind, has_qr = TYPES[kind_key]
    if qr_type not in ctx.allowed_types:
        fail("tipo", f"Il tipo «{TYPE_LABELS[qr_type]}» non è incluso nel piano.")

    row: dict = {"row": number, "qr_type": qr_type, "kind": kind, "has_qr": has_qr,
                 "target_url": "", "static_data": None, "page": None, "alias": "",
                 "folder": [], "tags": [], "style": None}  # fmt: skip
    destination = cells.get("destination", "").strip()
    needs_url = qr_type == "website"
    fields: dict[str, str] = {}
    if cells.get("fields", "").strip():
        try:
            fields = parse_fields(cells["fields"])
        except ValueError as exc:
            fail("campi", str(exc))

    urls: list[str] = []
    if needs_url:
        if not destination:
            fail("destinazione", "Inserisci l'URL di destinazione.")
        else:
            try:
                utm = {k: cells.get(f"utm_{k}", "").strip() for k in UTM_KEYS}
                target = valid_url(with_utm(destination, utm))
                urls.append(target)
                if kind == "dynamic":
                    row["target_url"] = target
                else:
                    row["static_data"] = {"url": target}
                    row["target_url"] = target
            except ValueError as exc:
                fail("destinazione", str(exc))
    else:
        allowed = FIELD_MAP[qr_type]
        mapped = {}
        for key, value in fields.items():
            if key not in allowed:
                fail("campi", f"Campo «{key}» non valido per «{TYPE_LABELS[qr_type]}».")
            else:
                mapped[allowed[key]] = value
        try:
            if qr_type == "vcard":
                row["page"] = vcard_page(mapped, ctx.company)
                urls += [v for v in (mapped.get("website"),) if v]
            else:
                from ..qr.service import validate_static

                if "hidden" in mapped:
                    mapped["hidden"] = mapped["hidden"].lower() in ("1", "si", "sì", "true", "yes")
                if mapped.get("encryption"):
                    mapped["encryption"] = {"wpa": "WPA", "wep": "WEP", "nessuna": "nopass",
                                            "nopass": "nopass"}.get(mapped["encryption"].lower(),
                                                                     mapped["encryption"])  # fmt: skip
                row["static_data"] = validate_static(qr_type, mapped)
        except CodedError as exc:
            fail("campi", exc.detail)
        except ValueError as exc:
            fail("campi", str(exc).split("\n")[0])
        except ValidationError as exc:  # the vCard page builder
            fail("campi", str(exc.errors()[0]["msg"]).removeprefix("Value error, "))

    for url in urls:
        host = (urlsplit(url).hostname or "").lower()
        if host_blocked(ctx.blocked, host):
            fail("destinazione", "Questa destinazione non è consentita su Vorya QR.")
    row["urls"] = urls

    name = " ".join(cells.get("name", "").split())
    if not name:
        host = urlsplit(row["target_url"]).hostname if row["target_url"] else ""
        name = host or f"{TYPE_LABELS[qr_type]} {number}"
    if len(name) > 120:
        fail("nome", "Il nome supera i 120 caratteri.")
    row["name"] = name[:120]

    alias = normalise_alias(cells.get("back_half", ""))
    if alias:
        if kind != "dynamic":
            fail("back_half", "Il back-half vale solo per link e QR dinamici.")
        elif not features_of(ctx.plan).custom_back_half:
            fail("back_half", "Back-half personalizzato: disponibile nel piano Pro.")
        else:
            problem = alias_problem(ctx.session, alias, ctx.workspace.id)
            if problem:
                fail("back_half", problem)
            elif alias in ctx.seen_aliases:
                fail("back_half", "Back-half ripetuto nel file.")
            ctx.seen_aliases.add(alias)
        row["alias"] = alias

    folder = [p.strip() for p in cells.get("folder", "").split("/") if p.strip()]
    if len(folder) > 2:
        fail("cartella", "Le cartelle si annidano al massimo su 2 livelli (es. Eventi/2026).")
    elif any(len(p) > 80 for p in folder):
        fail("cartella", "Il nome di una cartella supera gli 80 caratteri.")
    row["folder"] = folder

    tags = [t.strip() for t in cells.get("tags", "").split("|") if t.strip()]
    if len(tags) > 20 or any(len(t) > 40 for t in tags):
        fail("tag", "Massimo 20 tag per riga, di al massimo 40 caratteri.")
    row["tags"] = list(dict.fromkeys(tags))

    style = cells.get("style", "").strip()
    if style:
        if slug(style) not in ctx.styles:
            fail("stile", f"Lo stile «{style}» non esiste: salvalo prima nella sezione Stili.")
        elif not has_qr:
            fail("stile", "Un link senza QR non ha uno stile.")
        else:
            row["style"] = ctx.styles[slug(style)].id
    return (None if errors else row), errors


PREVIEW_ROWS = 200


def validate_file(
    ctx: Context, raw: bytes, max_rows: int
) -> tuple[list[dict], list[dict], int, list[dict]]:
    """-> (valid rows, errors, total rows, preview). A single error keeps the import from
    being confirmed: the user fixes the file and uploads it again."""
    header, body, _ = read_table(raw)
    columns = map_columns(header)
    if "type" not in columns:
        raise CodedError(422, "Manca la colonna «tipo». Scarica il modello CSV.", "missing_column")
    if len(body) > max_rows:
        raise CodedError(
            422,
            f"Il file ha {len(body)} righe: il piano ne consente al massimo {max_rows} per import.",
            "too_many_rows",
        )
    rows, errors, preview = [], [], []
    for index, cells in enumerate(body, start=2):  # row 1 is the header, as in Excel
        values = {c: (cells[i].strip() if i < len(cells) else "") for c, i in columns.items()}
        if len(preview) < PREVIEW_ROWS:
            preview.append({"row": index, "cells": {c: v[:200] for c, v in values.items()}})
        row, problems = validate_row(ctx, index, values)
        errors += problems
        if row:
            rows.append(row)
    return rows, errors, len(body), preview
