from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..core.config import get_settings

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
    if parts.hostname == short.hostname and parts.path.startswith("/r/"):
        raise ValueError("La destinazione non può essere un altro link breve Vorya QR")
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


class QrUpdate(QrStyle):
    name: str = Field(min_length=1, max_length=120)
    target_url: str = Field(min_length=1, max_length=2048)

    @field_validator("name")
    @classmethod
    def trimmed(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Inserisci un nome")
        return value

    _url = field_validator("target_url")(classmethod(lambda cls, v: valid_url(v)))


class QrCreate(QrUpdate):
    kind: Literal["static", "dynamic"]
    content_type: Literal["url"] = "url"


class QrPreview(QrStyle):
    kind: Literal["static", "dynamic"]
    target_url: str = Field(default="", max_length=2048)
    qr_id: int | None = None


class QrOut(BaseModel):
    id: int
    name: str
    kind: str
    content_type: str
    target_url: str
    slug: str | None
    short_url: str | None
    status: str
    fg_color: str
    bg_color: str
    margin: int
    error_correction: str
    scan_count: int
    created_at: datetime
    updated_at: datetime
