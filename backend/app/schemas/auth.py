from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from ..core.security import TOKEN_PATTERN, normalized_email


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _password(value: str) -> str:
    if not value.strip():
        raise ValueError("La password non può essere vuota")
    return value


class EmailInput(Strict):
    email: EmailStr = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        return normalized_email(value)


class LoginInput(EmailInput):
    password: str = Field(min_length=1, max_length=128, repr=False)
    remember: bool = False


class AttributionIn(BaseModel):
    """Where the signup came from (first touch). Everything optional, short and sanitised."""

    model_config = ConfigDict(extra="ignore")
    utm_source: str = Field(default="", max_length=100)
    utm_medium: str = Field(default="", max_length=100)
    utm_campaign: str = Field(default="", max_length=100)
    utm_content: str = Field(default="", max_length=100)
    utm_term: str = Field(default="", max_length=100)
    referrer: str = Field(default="", max_length=200)  # host + path, never the query string
    landing: str = Field(default="", max_length=64, pattern=r"^(/[a-z0-9/_-]{0,60})?$")
    generator: str = Field(default="", max_length=16)  # QR type made with the free generator


class HandoffIn(BaseModel):
    """The static QR the visitor was making: becomes a dynamic QR after the email check."""

    model_config = ConfigDict(extra="forbid")
    type: Literal["website", "vcard_static"]
    data: dict
    design: dict | None = None


class RegisterInput(EmailInput):
    attribution: AttributionIn | None = None
    handoff: HandoffIn | None = None
    display_name: str = Field(min_length=2, max_length=160)
    workspace_name: str = Field(min_length=2, max_length=160)
    accept_terms: bool

    @field_validator("display_name", "workspace_name")
    @classmethod
    def trimmed(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Inserisci almeno 2 caratteri")
        return value

    @field_validator("accept_terms")
    @classmethod
    def accepted(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Devi accettare termini e privacy")
        return value


class TokenInput(Strict):
    token: str = Field(pattern=TOKEN_PATTERN, repr=False)


class SetPasswordInput(TokenInput):
    password: str = Field(min_length=12, max_length=128, repr=False)
    confirm_password: str = Field(min_length=12, max_length=128, repr=False)

    _check_password = field_validator("password")(classmethod(lambda cls, v: _password(v)))

    @model_validator(mode="after")
    def match(self):
        if self.password != self.confirm_password:
            raise ValueError("Le password non coincidono")
        return self


class ResetInput(SetPasswordInput):
    pass


class VerifyInput(SetPasswordInput):
    pass


class WorkspaceSummary(BaseModel):
    id: int
    name: str
    plan_id: str
    access: str
    trial_ends_at: datetime | None


class Me(BaseModel):
    id: int
    display_name: str
    email: str
    role: str
    workspace: WorkspaceSummary | None
    last_company_id: int | None = None
    support_email: str
