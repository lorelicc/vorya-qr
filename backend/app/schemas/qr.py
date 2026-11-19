from datetime import datetime
from typing import Literal
from urllib.parse import parse_qsl, urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..core.config import get_settings
from ..plans import QrType
from .design import QrDesign
from .page import Page

HEX = r"^#[0-9a-fA-F]{6}$"


def valid_url(value: str) -> str:
    value = value.strip()
    if any(ch.isspace() or ord(ch) < 32 for ch in value):
        raise ValueError("L'URL non può contenere spazi")
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError("Inserisci un URL completo che inizi con https:// o http://")
    if parts.username or parts.password:
        raise ValueError("L'URL non può contenere credenziali")
    short = urlsplit(get_settings().short_link_base_url)
    path = parts.path.strip("/")
    if parts.hostname == short.hostname and (path.startswith("r/") or (path and "/" not in path)):
        # /r/{slug} and, from 0.3, /{slug}: a short link pointing to a short link loops.
        raise ValueError("La destinazione non può essere un altro link breve Vorya QR")
    keys = [k.lower() for k, _ in parse_qsl(parts.query, keep_blank_values=True)]
    duplicate = next((k for k in keys if keys.count(k) > 1), None)
    if duplicate:  # 0.3 UTM builder: never two values for the same parameter
        raise ValueError(f"Il parametro «{duplicate}» compare più volte nell'URL")
    return value


class QrStyle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fg_color: str = Field(default="#091411", pattern=HEX)
    bg_color: str = Field(default="#ffffff", pattern=HEX)
    margin: int = Field(default=4, ge=0, le=16)
    error_correction: Literal["L", "M", "Q", "H"] = "M"

    @field_validator("fg_color", "bg_color")
    @classmethod
    def lower(cls, value: str) -> str:
        return value.lower()


def _name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Inserisci un nome")
    return value


class QrContent(QrStyle):
    """Content fields shared by create, update and preview. Which ones apply depends on the type:
    website -> target_url (dynamic) or static_data.url (static); wifi/text/email/sms/phone/
    whatsapp -> static_data; vcard/pdf/music/link_in_bio/gallery/business -> page."""

    target_url: str = Field(default="", max_length=2048)
    static_data: dict | None = None
    page: Page | None = None
    design: QrDesign | None = None  # 0.2 designer; when absent the 0.1 style fields apply


class QrUpdate(QrContent):
    name: str = Field(min_length=1, max_length=120)
    # 0.3: dynamic links can change type; static QR codes never can (409).
    qr_type: QrType | None = None

    _name = field_validator("name")(classmethod(lambda cls, v: _name(v)))


class QrCreate(QrUpdate):
    qr_type: QrType = "website"  # type: ignore[assignment]
    dynamic: bool = True  # only meaningful for "website"; other types have a fixed kind
    has_qr: bool = True  # 0.3: false = short link only (dynamic types), QR can be added later


class LinkQuickCreate(BaseModel):
    """0.3 quick short link: paste a URL, get a link (no QR yet)."""

    model_config = ConfigDict(extra="forbid")
    target_url: str = Field(min_length=1, max_length=2048)
    name: str = Field(default="", max_length=120)


class QrPreview(QrContent):
    qr_type: QrType = "website"
    dynamic: bool = True
    qr_id: int | None = None


class QrOut(BaseModel):
    id: int
    name: str
    kind: str
    qr_type: str
    destination: str
    content_type: str
    target_url: str
    static_data: dict | None
    slug: str | None
    short_url: str | None
    root_url: str | None = None  # 0.3: https://qr.vorya.it/{slug}
    status: str
    has_qr: bool = True
    scan_total: int = 0
    blocked_reason: str | None = None
    fg_color: str
    bg_color: str
    margin: int
    error_correction: str
    design: dict | None
    scan_count: int
    spark: list[int] | None = None  # last 7 days, dashboard list only
    created_at: datetime
    updated_at: datetime
