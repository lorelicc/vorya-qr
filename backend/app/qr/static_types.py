"""Static QR contents: the data is encoded directly in the QR (no server involved at scan time)."""

from typing import Literal
from urllib.parse import quote

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..schemas.page import http_url

PHONE = r"^\+?[0-9 ().-]{3,30}$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WebsiteData(Strict):
    url: str = Field(min_length=1, max_length=2048)

    _url = field_validator("url")(classmethod(lambda cls, v: http_url(v)))


class WifiData(Strict):
    ssid: str = Field(min_length=1, max_length=32)
    password: str = Field(default="", max_length=63)
    encryption: Literal["WPA", "WEP", "nopass"] = "WPA"
    hidden: bool = False


class TextData(Strict):
    text: str = Field(min_length=1, max_length=1000)


class EmailData(Strict):
    to: str = Field(max_length=254, pattern=r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")
    subject: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=1000)


class SmsData(Strict):
    number: str = Field(pattern=PHONE)
    message: str = Field(default="", max_length=500)


class PhoneData(Strict):
    number: str = Field(pattern=PHONE)


class WhatsappData(Strict):
    number: str = Field(pattern=PHONE)
    message: str = Field(default="", max_length=500)


class VcardStaticData(Strict):
    """A business card written inside the QR (0.5). Short on purpose: long cards make dense QRs."""

    first_name: str = Field(default="", max_length=60)
    last_name: str = Field(default="", max_length=60)
    organization: str = Field(default="", max_length=80)
    job_title: str = Field(default="", max_length=60)
    phone: str = Field(default="", pattern=r"^(\+?[0-9 ().-]{3,30})?$")
    email: str = Field(default="", max_length=120, pattern=r"^([^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)?$")
    website: str = Field(default="", max_length=200)
    street: str = Field(default="", max_length=100)
    city: str = Field(default="", max_length=60)

    @field_validator("website")
    @classmethod
    def website_url(cls, value: str) -> str:
        return http_url(value) if value.strip() else ""

    @model_validator(mode="after")
    def has_name(self):
        if not (self.first_name or self.last_name or self.organization):
            raise ValueError("Inserisci almeno nome, cognome o azienda")
        return self


STATIC_SCHEMAS: dict[str, type[Strict]] = {
    "website": WebsiteData,
    "wifi": WifiData,
    "text": TextData,
    "email": EmailData,
    "sms": SmsData,
    "phone": PhoneData,
    "whatsapp": WhatsappData,
    "vcard_static": VcardStaticData,
}


def _wifi_escape(value: str) -> str:
    for char in ("\\", ";", ",", ":", '"'):
        value = value.replace(char, f"\\{char}")
    return value


def digits(number: str) -> str:
    return "".join(c for c in number if c.isdigit() or c == "+")


def _vcard_text(d: VcardStaticData) -> str:
    from ..pages.vcard import vcard
    from ..schemas.page import Address, ContactBlock, Email, Phone

    block = ContactBlock(
        id="s", type="contact", first_name=d.first_name, last_name=d.last_name,
        organization=d.organization, job_title=d.job_title,
        phones=[Phone(number=d.phone)] if d.phone else [],
        emails=[Email(address=d.email)] if d.email else [],
        website=d.website, address=Address(street=d.street, city=d.city),
    )  # fmt: skip
    return vcard(block)


def encode_static(qr_type: str, data: dict) -> str:
    """Payload written inside the QR, following the formats phone cameras understand."""
    d = STATIC_SCHEMAS[qr_type].model_validate(data)
    if qr_type == "website":
        return d.url
    if qr_type == "wifi":
        password = f"P:{_wifi_escape(d.password)};" if d.encryption != "nopass" else ""
        hidden = "H:true;" if d.hidden else ""
        return f"WIFI:T:{d.encryption};S:{_wifi_escape(d.ssid)};{password}{hidden};"
    if qr_type == "vcard_static":
        return _vcard_text(d)
    if qr_type == "text":
        return d.text
    if qr_type == "email":
        params = "&".join(
            f"{k}={quote(v)}" for k, v in (("subject", d.subject), ("body", d.body)) if v
        )
        return f"mailto:{d.to}" + (f"?{params}" if params else "")
    if qr_type == "sms":
        return f"SMSTO:{digits(d.number)}:{d.message}"
    if qr_type == "phone":
        return f"tel:{digits(d.number)}"
    number = digits(d.number).lstrip("+")
    return f"https://wa.me/{number}" + (f"?text={quote(d.message)}" if d.message else "")
