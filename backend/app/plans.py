"""Plan features (plans.features JSON), validated by Pydantic.

Quantity limits for QR codes stay in dedicated columns (max_qr_static, max_dynamic_qr) and
max_companies; everything else lives here. None means unlimited.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .core.errors import CodedError

QrType = Literal[
    "website",
    "vcard",
    "pdf",
    "music",
    "link_in_bio",
    "gallery",
    "business",
    "wifi",
    "text",
    "email",
    "sms",
    "phone",
    "whatsapp",
]
ALL_TYPES: tuple[str, ...] = QrType.__args__  # type: ignore[attr-defined]
PAGE_TYPES = ("vcard", "pdf", "music", "link_in_bio", "gallery", "business")
STATIC_TYPES = ("wifi", "text", "email", "sms", "phone", "whatsapp")
BASE_TYPES = ("website", *STATIC_TYPES)
TYPE_LABELS = {
    "website": "Sito web",
    "vcard": "vCard",
    "pdf": "PDF",
    "music": "Musica",
    "link_in_bio": "Link in bio",
    "gallery": "Galleria",
    "business": "Pagina attività",
    "wifi": "Wi-Fi",
    "text": "Testo",
    "email": "Email",
    "sms": "SMS",
    "phone": "Telefono",
    "whatsapp": "WhatsApp",
}


class PlanFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allowed_types: list[QrType] = Field(default_factory=lambda: list(BASE_TYPES))
    storage_mb: int | None = Field(default=100, ge=0, le=1_000_000)
    max_file_mb: int = Field(default=10, ge=1, le=500)
    remove_branding: bool = False
    stats_retention_days: int | None = Field(default=90, ge=1, le=36_500)
    max_style_presets: int | None = Field(default=3, ge=0, le=10_000)

    @field_validator("allowed_types")
    @classmethod
    def unique(cls, value: list[str]) -> list[str]:
        return sorted(set(value), key=ALL_TYPES.index)


def features_of(plan) -> PlanFeatures:
    return PlanFeatures.model_validate(plan.features or {}) if plan else PlanFeatures()


def locked(feature_label: str, plan_name: str = "Pro") -> CodedError:
    return CodedError(403, f"{feature_label}: disponibile nel piano {plan_name}.", "feature_locked")


def require_type(plan, qr_type: str) -> None:
    if qr_type not in features_of(plan).allowed_types:
        raise locked(f"Il tipo «{TYPE_LABELS[qr_type]}»")
