"""Billing data: formal validation of Italian VAT number (P.IVA) and tax code (CF).

Only the checksum/shape is verified (no registry lookup); the e-invoice itself is issued outside
the app from the admin payments export.
"""

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PERSON_CF = re.compile(
    r"^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
)
SDI = re.compile(r"^[A-Z0-9]{7}$")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")

_ODD = {
    **dict(zip("0123456789", [1, 0, 5, 7, 9, 13, 15, 17, 19, 21], strict=True)),
    **dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ", [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23], strict=True)),
}  # fmt: skip


def valid_vat(value: str) -> bool:
    """11 digits, last one is the Luhn-style check digit used by the Italian P.IVA."""
    if not re.fullmatch(r"\d{11}", value) or value[:7] == "0000000":
        return False
    total = 0
    for index, char in enumerate(value[:10]):
        digit = int(char)
        if index % 2:
            digit *= 2
            digit = digit - 9 if digit > 9 else digit
        total += digit
    return (10 - total % 10) % 10 == int(value[10])


def valid_tax_code(value: str) -> bool:
    """Person CF (16 chars, check letter) or company CF (11 digits, same rule as the P.IVA)."""
    if re.fullmatch(r"\d{11}", value):
        return valid_vat(value)
    if not PERSON_CF.match(value):
        return False
    total = 0
    for index, char in enumerate(value[:15]):
        if index % 2 == 0:  # positions 1,3,5... (odd, 1-based)
            total += _ODD[char]
        else:
            total += int(char) if char.isdigit() else ord(char) - ord("A")
    return chr(ord("A") + total % 26) == value[15]


class BillingProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    legal_name: str = Field(min_length=2, max_length=160)
    vat: str = Field(default="", max_length=20)
    tax_code: str = Field(default="", max_length=20)
    address: str = Field(min_length=3, max_length=200)
    zip: str = Field(min_length=3, max_length=12)
    city: str = Field(min_length=2, max_length=80)
    province: str = Field(default="", max_length=3)
    country: str = Field(default="IT", min_length=2, max_length=2)
    sdi_code: str = Field(default="", max_length=7)
    pec: str = Field(default="", max_length=160)

    @field_validator("vat", "tax_code", "sdi_code", "province", "country", mode="after")
    @classmethod
    def upper(cls, value: str) -> str:
        return value.replace(" ", "").upper()

    @field_validator("vat", mode="after")
    @classmethod
    def strip_country(cls, value: str) -> str:
        return value[2:] if value.startswith("IT") and len(value) == 13 else value

    @model_validator(mode="after")
    def check(self) -> "BillingProfileIn":
        italy = self.country == "IT"
        if not (self.vat or self.tax_code):
            raise ValueError("Indica la partita IVA e/o il codice fiscale.")
        if italy:
            if self.vat and not valid_vat(self.vat):
                raise ValueError("Partita IVA non valida.")
            if self.tax_code and not valid_tax_code(self.tax_code):
                raise ValueError("Codice fiscale non valido.")
            if not re.fullmatch(r"\d{5}", self.zip):
                raise ValueError("CAP non valido (5 cifre).")
            if not re.fullmatch(r"[A-Z]{2}", self.province):
                raise ValueError("Indica la sigla della provincia (es. MI).")
            if not (self.sdi_code or self.pec):
                raise ValueError("Indica il codice SDI e/o la PEC.")
        if self.sdi_code and not SDI.match(self.sdi_code):
            raise ValueError("Codice SDI non valido (7 caratteri).")
        if self.pec and not EMAIL.match(self.pec):
            raise ValueError("PEC non valida.")
        return self
