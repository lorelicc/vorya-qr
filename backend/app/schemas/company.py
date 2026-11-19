from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..core.security import normalized_email

HEX = r"^#[0-9a-fA-F]{6}$"


class CompanyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    primary_color: str = Field(default="#087f5b", pattern=HEX)
    secondary_color: str = Field(default="#00e99a", pattern=HEX)
    sector: str | None = Field(default=None, max_length=80)

    @field_validator("name")
    @classmethod
    def trimmed(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Inserisci il nome dell'azienda")
        return value

    @field_validator("primary_color", "secondary_color")
    @classmethod
    def lower(cls, value: str) -> str:
        return value.lower()

    @field_validator("sector")
    @classmethod
    def blank_none(cls, value: str | None) -> str | None:
        return " ".join(value.split()) or None if value else None


class CompanyDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_name: str = Field(min_length=1, max_length=120)


class CompanyOut(BaseModel):
    id: int
    name: str
    logo_url: str | None
    primary_color: str
    secondary_color: str
    sector: str | None
    qr_count: int
    scans_7d: int
    created_at: datetime
    deleted_at: datetime | None
    purge_after: datetime | None


class TransferCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return normalized_email(value)


class TransferToken(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$", repr=False)


class LastCompany(BaseModel):
    model_config = ConfigDict(extra="forbid")
    company_id: int
