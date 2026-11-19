"""Hosted pages: a typed JSON document of blocks (schema_version 1).

Every block is validated by its own model (discriminated union on `type`). Users never provide
HTML or JS: texts are plain text; the `text` block accepts a minimal markdown subset (bold,
italic, http(s) links) that is rendered without ever interpreting HTML. Files are referenced
by id and checked against the company that owns the page.
"""

import re
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HEX = r"^#[0-9a-fA-F]{6}$"
FILE_ID = r"^[0-9a-f-]{36}$"
BLOCK_ID = r"^[A-Za-z0-9_-]{1,24}$"
SCHEMA_VERSION = 1


def http_url(value: str) -> str:
    value = value.strip()
    parts = urlsplit(value)
    if (
        parts.scheme not in ("http", "https")
        or not parts.hostname
        or any(c.isspace() for c in value)
    ):
        raise ValueError("Inserisci un URL completo che inizi con https://")
    return value


Url = Annotated[str, Field(min_length=1, max_length=2048)]
Short = Annotated[str, Field(max_length=120)]
Medium = Annotated[str, Field(max_length=300)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Block(Strict):
    id: str = Field(pattern=BLOCK_ID)


class HeaderBlock(Block):
    type: Literal["header"]
    cover_file_id: str | None = Field(default=None, pattern=FILE_ID)
    avatar_file_id: str | None = Field(default=None, pattern=FILE_ID)
    title: Short = ""
    subtitle: Medium = ""


class TextBlock(Block):
    type: Literal["text"]
    markdown: str = Field(default="", max_length=4000)


class ButtonBlock(Block):
    type: Literal["button"]
    label: Short
    url: Url

    _url = field_validator("url")(classmethod(lambda cls, v: http_url(v)))


class LinkItem(Strict):
    label: Short
    url: Url

    _url = field_validator("url")(classmethod(lambda cls, v: http_url(v)))


class LinkListBlock(Block):
    type: Literal["link_list"]
    items: list[LinkItem] = Field(default_factory=list, max_length=30)


class Phone(Strict):
    label: Literal["cell", "work", "home", "other"] = "cell"
    number: str = Field(max_length=40, pattern=r"^[+0-9 ().-]{3,40}$")


class Email(Strict):
    label: Literal["work", "home", "other"] = "work"
    address: str = Field(max_length=254, pattern=r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")


class Address(Strict):
    street: Medium = ""
    city: Short = ""
    postal_code: str = Field(default="", max_length=20)
    region: Short = ""
    country: Short = ""


class ContactBlock(Block):
    type: Literal["contact"]
    first_name: Short = ""
    last_name: Short = ""
    organization: Short = ""
    job_title: Short = ""
    phones: list[Phone] = Field(default_factory=list, max_length=6)
    emails: list[Email] = Field(default_factory=list, max_length=6)
    website: str = Field(default="", max_length=2048)
    address: Address = Field(default_factory=Address)
    note: str = Field(default="", max_length=500)
    save_button_label: Short = "Salva contatto"

    @field_validator("website")
    @classmethod
    def website_url(cls, value: str) -> str:
        return http_url(value) if value.strip() else ""

    @model_validator(mode="after")
    def has_name(self):
        if not (self.first_name or self.last_name or self.organization):
            raise ValueError("Inserisci almeno nome, cognome o azienda")
        return self


class FileBlock(Block):
    type: Literal["file"]
    file_id: str = Field(pattern=FILE_ID)
    label: Short = ""
    allow_download: bool = True


class Track(Strict):
    file_id: str = Field(pattern=FILE_ID)
    title: Short
    artist: Short = ""


class AudioPlayerBlock(Block):
    type: Literal["audio_player"]
    tracks: list[Track] = Field(min_length=1, max_length=30)


MusicPlatform = Literal["spotify", "apple_music", "youtube_music", "amazon_music", "soundcloud"]


class MusicLink(Strict):
    platform: MusicPlatform
    url: Url

    _url = field_validator("url")(classmethod(lambda cls, v: http_url(v)))


class MusicLinksBlock(Block):
    type: Literal["music_links"]
    links: list[MusicLink] = Field(default_factory=list, max_length=5)


class GalleryBlock(Block):
    type: Literal["gallery"]
    file_ids: list[Annotated[str, Field(pattern=FILE_ID)]] = Field(min_length=1, max_length=40)
    layout: Literal["grid", "stack"] = "grid"


SocialNetwork = Literal[
    "instagram", "facebook", "tiktok", "linkedin", "x", "youtube", "threads", "pinterest",
    "telegram", "whatsapp", "website",
]  # fmt: skip


class SocialItem(Strict):
    network: SocialNetwork
    url: Url

    _url = field_validator("url")(classmethod(lambda cls, v: http_url(v)))


class SocialIconsBlock(Block):
    type: Literal["social_icons"]
    items: list[SocialItem] = Field(default_factory=list, max_length=12)


TIME = r"^([01]\d|2[0-3]):[0-5]\d$"


class TimeRange(Strict):
    opens: str = Field(pattern=TIME)
    closes: str = Field(pattern=TIME)


class Day(Strict):
    day: Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    closed: bool = False
    ranges: list[TimeRange] = Field(default_factory=list, max_length=3)


class OpeningHoursBlock(Block):
    type: Literal["opening_hours"]
    days: list[Day] = Field(default_factory=list, max_length=7)
    note: Medium = ""


class AddressBlock(Block):
    type: Literal["address"]
    label: Short = ""
    query: str = Field(min_length=3, max_length=300)
    providers: list[Literal["google", "apple"]] = Field(default_factory=lambda: ["google", "apple"])


class DividerBlock(Block):
    type: Literal["divider"]
    style: Literal["line", "space"] = "line"


ALLERGENS = (
    "gluten", "crustaceans", "eggs", "fish", "peanuts", "soy", "milk", "nuts", "celery",
    "mustard", "sesame", "sulphites", "lupin", "molluscs",
)  # fmt: skip  # the 14 of Reg. (EU) 1169/2011, annex II
BADGES = ("vegan", "vegetarian", "organic", "gluten_free", "new", "recommended")
PRICE = r"^\d{1,5}([.,]\d{1,2})?$"


def _price(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if not re.match(PRICE, value):
        raise ValueError("Prezzo non valido (es. 12,50)")
    return f"{float(value.replace(',', '.')):.2f}"


class Localized(Strict):
    """Italian is the base language; a missing English text falls back to Italian."""

    it: Annotated[str, Field(max_length=300)] = ""
    en: Annotated[str, Field(max_length=300)] = ""


class WineInfo(Strict):
    producer: Short = ""
    appellation: Literal["", "DOC", "DOCG", "IGT", "IGP", "DOP", "Vino da tavola", "Altro"] = ""
    denomination: Short = ""
    vintage: int | None = Field(default=None, ge=1800, le=2100)
    grapes: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=8)
    area: Short = ""
    price_glass: str | None = None
    price_bottle: str | None = None

    _glass = field_validator("price_glass")(classmethod(lambda cls, v: _price(v)))
    _bottle = field_validator("price_bottle")(classmethod(lambda cls, v: _price(v)))


class MenuItem(Strict):
    id: str = Field(pattern=BLOCK_ID)
    name: Localized
    description: Localized = Field(default_factory=Localized)
    price: str | None = None
    photo_file_id: str | None = Field(default=None, pattern=FILE_ID)
    allergens: list[Literal[ALLERGENS]] = Field(default_factory=list, max_length=14)  # type: ignore[valid-type]
    badges: list[Literal[BADGES]] = Field(default_factory=list, max_length=6)  # type: ignore[valid-type]
    sold_out: bool = False
    wine: WineInfo | None = None

    _price = field_validator("price")(classmethod(lambda cls, v: _price(v)))

    @model_validator(mode="after")
    def named(self):
        if not self.name.it.strip():
            raise ValueError("Ogni voce ha bisogno di un nome")
        self.allergens = sorted(set(self.allergens), key=ALLERGENS.index)
        self.badges = sorted(set(self.badges), key=BADGES.index)
        return self


class MenuSection(Strict):
    id: str = Field(pattern=BLOCK_ID)
    kind: Literal["food", "wine"] = "food"
    title: Localized
    items: list[MenuItem] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def titled(self):
        if not self.title.it.strip():
            raise ValueError("Ogni sezione ha bisogno di un titolo")
        return self


class MenuBlock(Block):
    type: Literal["menu"]
    currency: Literal["EUR", "GBP", "USD", "CHF"] = "EUR"
    intro: Localized = Field(default_factory=Localized)
    sections: list[MenuSection] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def limits(self):
        ids = [s.id for s in self.sections] + [i.id for s in self.sections for i in s.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Sezioni e voci devono avere id univoci")
        if sum(len(s.items) for s in self.sections) > 300:
            raise ValueError("Massimo 300 voci per menu")
        return self


AnyBlock = Annotated[
    HeaderBlock | TextBlock | ButtonBlock | LinkListBlock | ContactBlock | FileBlock
    | AudioPlayerBlock | MusicLinksBlock | GalleryBlock | SocialIconsBlock | OpeningHoursBlock
    | AddressBlock | DividerBlock | MenuBlock,
    Field(discriminator="type"),
]  # fmt: skip


class Background(Strict):
    type: Literal["solid", "gradient", "image"] = "solid"
    color: str = Field(default="#f5faf7", pattern=HEX)
    to: str = Field(default="#d8fae9", pattern=HEX)
    angle: int = Field(default=160, ge=0, le=360)
    file_id: str | None = Field(default=None, pattern=FILE_ID)
    overlay: float = Field(default=0.45, ge=0, le=0.9)


class Theme(Strict):
    primary: str = Field(default="#087f5b", pattern=HEX)
    secondary: str = Field(default="#00e99a", pattern=HEX)
    background: Background = Field(default_factory=Background)
    button_style: Literal["rounded", "pill", "square", "outline"] = "rounded"
    font: Literal["inter", "montserrat", "playfair", "space-grotesk"] = "inter"


class OpenGraph(Strict):
    title: Short = ""
    description: Medium = ""
    image_file_id: str | None = Field(default=None, pattern=FILE_ID)


class PageSettings(Strict):
    languages: list[Literal["it", "en"]] = Field(default_factory=lambda: ["it"], min_length=1)
    indexable: bool = False
    show_branding: bool = True
    og: OpenGraph = Field(default_factory=OpenGraph)


Template = Literal["vcard", "pdf", "music", "link_in_bio", "gallery", "business", "menu"]


class Page(Strict):
    schema_version: Literal[1] = SCHEMA_VERSION
    template: Template
    theme: Theme = Field(default_factory=Theme)
    settings: PageSettings = Field(default_factory=PageSettings)
    blocks: list[AnyBlock] = Field(min_length=1, max_length=40)

    @model_validator(mode="after")
    def template_rules(self):
        ids = [b.id for b in self.blocks]
        if len(ids) != len(set(ids)):
            raise ValueError("Ogni blocco deve avere un id univoco")
        types = [b.type for b in self.blocks]
        allowed = TEMPLATE_BLOCKS[self.template]
        if not set(types) <= allowed:
            extra = ", ".join(sorted(set(types) - allowed))
            raise ValueError(f"Blocchi non previsti per questo tipo: {extra}")
        missing = TEMPLATE_REQUIRED[self.template] - set(types)
        if missing:
            raise ValueError(f"Manca il contenuto principale ({', '.join(sorted(missing))})")
        return self

    def file_ids(self) -> set[str]:
        found: set[str] = set()
        for block in self.blocks:
            for value in _walk(block.model_dump()):
                found.add(value)
        if self.theme.background.file_id:
            found.add(self.theme.background.file_id)
        if self.settings.og.image_file_id:
            found.add(self.settings.og.image_file_id)
        return found


_FILE_RE = re.compile(FILE_ID)


def _walk(data) -> list[str]:
    out: list[str] = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key.endswith("file_id") and isinstance(value, str) and _FILE_RE.match(value):
                out.append(value)
            elif key == "file_ids" and isinstance(value, list):
                out.extend(v for v in value if isinstance(v, str))
            else:
                out.extend(_walk(value))
    elif isinstance(data, list):
        for item in data:
            out.extend(_walk(item))
    return out


COMMON = {"header", "text", "button", "divider", "social_icons"}
TEMPLATE_BLOCKS: dict[str, set[str]] = {
    "vcard": COMMON | {"contact", "address", "link_list"},
    "pdf": COMMON | {"file"},
    "music": COMMON | {"audio_player", "music_links"},
    "link_in_bio": COMMON | {"link_list"},
    "gallery": COMMON | {"gallery"},
    "business": COMMON | {"opening_hours", "address", "contact", "link_list", "gallery"},
    "menu": COMMON | {"menu", "opening_hours", "address", "contact", "link_list"},
}
TEMPLATE_REQUIRED: dict[str, set[str]] = {
    "vcard": {"contact"},
    "pdf": {"file"},
    "music": {"audio_player"},
    "link_in_bio": {"link_list"},
    "gallery": {"gallery"},
    "business": {"header"},
    "menu": {"menu"},
}
