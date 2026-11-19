from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[str] = mapped_column(String(24), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(500), default="")
    # NULL means unlimited.
    max_qr_static: Mapped[int | None] = mapped_column(Integer)
    max_dynamic_qr: Mapped[int | None] = mapped_column(Integer)
    max_companies: Mapped[int | None] = mapped_column(Integer, default=1)
    features: Mapped[dict] = mapped_column(JSON, default=dict)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(16), default="active")
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Billing (0.3): trialing|active|past_due|canceled|unpaid (NULL = never subscribed).
    billing_state: Mapped[str | None] = mapped_column(String(12))
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redirects_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Admin gift (0.4): while in the future the plan is active without payment.
    grant_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlatformSetting(Base):
    __tablename__ = "platform_settings"
    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class MailLog(Base):
    __tablename__ = "mail_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(24))
    success: Mapped[bool] = mapped_column(Boolean)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
