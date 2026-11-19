from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _origin(value: str, name: str) -> str:
    if not value:
        return value
    parts = urlsplit(value)
    if (
        parts.scheme not in ("http", "https")
        or not parts.netloc
        or parts.username
        or parts.password
        or parts.path not in ("", "/")
        or parts.query
        or parts.fragment
    ):
        raise ValueError(f"{name} deve essere un'origine HTTP(S), senza percorso o credenziali")
    return value.rstrip("/")


class Settings(BaseSettings):
    database_url: str
    app_env: Literal["development", "test", "production"] = "development"
    public_base_url: str = ""
    short_link_base_url: str = ""
    public_registration_enabled: bool = True
    support_email: str = "supporto@vorya.it"

    mail_transport: Literal["smtp", "file"] = "smtp"
    mail_file_dir: str = ".mail-outbox"
    smtp_host: str = ""
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_security: Literal["ssl", "starttls"] = "ssl"
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from_email: str = "noreply@vorya.it"
    smtp_from_name: str = "Vorya QR"
    smtp_timeout: int = Field(default=10, ge=1, le=30)

    # File storage: "local" (Docker volume, default) or "s3" (any S3-compatible service).
    storage_driver: Literal["local", "s3"] = "local"
    storage_local_path: str = "/data/uploads"
    storage_s3_endpoint: str = ""
    storage_s3_region: str = ""
    storage_s3_bucket: str = ""
    storage_s3_prefix: str = "vorya-qr/"
    storage_s3_access_key: SecretStr = SecretStr("")
    storage_s3_secret_key: SecretStr = SecretStr("")

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore", hide_input_in_errors=True)

    @field_validator("public_base_url")
    @classmethod
    def valid_public_url(cls, value: str) -> str:
        return _origin(value, "PUBLIC_BASE_URL")

    @field_validator("short_link_base_url")
    @classmethod
    def valid_short_url(cls, value: str) -> str:
        return _origin(value, "SHORT_LINK_BASE_URL")

    @field_validator("smtp_host", "smtp_user", "smtp_from_email", "smtp_from_name", "support_email")
    @classmethod
    def safe_header(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("Valore non valido per un'intestazione email")
        return value

    @field_validator("database_url")
    @classmethod
    def require_postgres(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL deve usare postgresql+psycopg://")
        return value

    @model_validator(mode="after")
    def production_rules(self):
        if self.app_env == "production":
            for name in ("public_base_url", "short_link_base_url"):
                if not getattr(self, name).startswith("https://"):
                    raise ValueError(f"{name.upper()} HTTPS obbligatoria in produzione")
            if self.mail_transport != "smtp":
                raise ValueError("In produzione MAIL_TRANSPORT deve essere smtp")
        if not self.short_link_base_url:
            self.short_link_base_url = self.public_base_url or "http://localhost:3000"
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
