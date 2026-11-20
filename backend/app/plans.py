"""Plan features (plans.features JSON), validated by Pydantic.

Quantity limits for QR codes stay in dedicated columns (max_qr_static, max_dynamic_qr) and
max_companies; everything else lives here. None means unlimited.
"""

from datetime import datetime
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
    "menu",
    "wifi",
    "text",
    "email",
    "sms",
    "phone",
    "whatsapp",
    "vcard_static",
]
ALL_TYPES: tuple[str, ...] = QrType.__args__  # type: ignore[attr-defined]
PAGE_TYPES = ("vcard", "pdf", "music", "link_in_bio", "gallery", "business", "menu")
STATIC_TYPES = ("wifi", "text", "email", "sms", "phone", "whatsapp", "vcard_static")
BASE_TYPES = ("website", *STATIC_TYPES)
TYPE_LABELS = {
    "website": "Sito web",
    "vcard": "vCard",
    "pdf": "PDF",
    "music": "Musica",
    "link_in_bio": "Link in bio",
    "gallery": "Galleria",
    "business": "Pagina attività",
    "menu": "Menu / Carta dei vini",
    "wifi": "Wi-Fi",
    "text": "Testo",
    "email": "Email",
    "sms": "SMS",
    "phone": "Telefono",
    "whatsapp": "WhatsApp",
    "vcard_static": "vCard statica",
}


class PlanFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allowed_types: list[QrType] = Field(default_factory=lambda: list(BASE_TYPES))
    storage_mb: int | None = Field(default=100, ge=0, le=1_000_000)
    max_file_mb: int = Field(default=10, ge=1, le=500)
    remove_branding: bool = False
    stats_retention_days: int | None = Field(default=90, ge=1, le=36_500)
    max_style_presets: int | None = Field(default=3, ge=0, le=10_000)
    # 0.3
    custom_back_half: bool = False
    max_aliases_per_link: int | None = Field(default=0, ge=0, le=1000)
    link_rules: bool = False  # expiry, password, scheduled destination
    utm_templates: bool = False
    max_bulk_rows: int = Field(default=0, ge=0, le=100_000)
    version_history: bool = False
    menu_type: bool = False
    # 0.5: automatic email reports to the customers of a company (frequencies allowed, recipients)
    report_frequencies: list[Literal["weekly", "monthly"]] = Field(default_factory=list)
    report_recipients: int = Field(default=0, ge=0, le=50)
    report_pdf: bool = False

    @field_validator("report_frequencies")
    @classmethod
    def unique_frequencies(cls, value: list[str]) -> list[str]:
        return sorted(set(value))

    @field_validator("allowed_types")
    @classmethod
    def unique(cls, value: list[str]) -> list[str]:
        return sorted(set(value), key=ALL_TYPES.index)


def features_of(plan) -> PlanFeatures:
    return PlanFeatures.model_validate(plan.features or {}) if plan else PlanFeatures()


def locked(feature_label: str, plan_name: str = "Pro") -> CodedError:
    return CodedError(403, f"{feature_label}: disponibile nel piano {plan_name}.", "feature_locked")


def effective_types(features: PlanFeatures) -> list[str]:
    """Types the plan allows. The 0.3 Menu type is switched by its own feature flag."""
    types = [t for t in features.allowed_types if t != "menu"]
    return [*types, "menu"] if features.menu_type else types


def require_type(plan, qr_type: str) -> None:
    if qr_type not in effective_types(features_of(plan)):
        raise locked(f"Il tipo «{TYPE_LABELS[qr_type]}»")


FREE_PLAN = "free"


def effective_plan_id(workspace, at: datetime | None = None) -> str:
    """The plan that applies RIGHT NOW (trial, gift or subscription ended -> Free).

    A running trial, gift or paid subscription gives the assigned plan; in every other case the
    workspace is on Free. All existing links, pages and files keep working on Free: only editing
    beyond the Free limits is locked (see app/limits.py).
    """
    from .core.security import now

    at = at or now()
    if workspace.grant_until is not None:
        return workspace.plan_id if workspace.grant_until > at else FREE_PLAN
    state = workspace.billing_state
    if state == "active":
        return workspace.plan_id
    if state == "past_due":
        grace = workspace.grace_until
        return workspace.plan_id if grace and grace > at else FREE_PLAN
    if state in ("canceled", "unpaid"):
        return FREE_PLAN
    if workspace.trial_ends_at is not None:
        return workspace.plan_id if workspace.trial_ends_at > at else FREE_PLAN
    return workspace.plan_id  # assigned by an admin


def plan_of(session, workspace):
    """The Plan row in force for a workspace (see effective_plan_id)."""
    from .models import Plan

    return session.get(Plan, effective_plan_id(workspace))
