from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    false,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base

TS = DateTime(timezone=True)


class BillingAccount(Base):
    __tablename__ = "billing_accounts"
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), primary_key=True)
    customer_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    subscription_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    stripe_status: Mapped[str | None] = mapped_column(String(24))
    plan_id: Mapped[str | None] = mapped_column(String(24))
    cycle: Mapped[str | None] = mapped_column(String(8))
    price_id: Mapped[str | None] = mapped_column(String(100))
    period_end: Mapped[datetime | None] = mapped_column(TS)
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )
    past_due_since: Mapped[datetime | None] = mapped_column(TS)
    checkout_id: Mapped[str | None] = mapped_column(String(100))
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class BillingPrice(Base):
    """Link between a plan/cycle and a Stripe price. Amounts are mirrored for display only."""

    __tablename__ = "billing_prices"
    __table_args__ = (
        Index(
            "uq_billing_prices_active",
            "plan_id",
            "cycle",
            unique=True,
            postgresql_where=text("active"),
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"))
    cycle: Mapped[str] = mapped_column(String(8))  # monthly | yearly
    stripe_price_id: Mapped[str] = mapped_column(String(100), unique=True)
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="eur", server_default="eur")
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class BillingProfile(Base):
    __tablename__ = "billing_profiles"
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), primary_key=True)
    legal_name: Mapped[str] = mapped_column(String(160))
    vat: Mapped[str] = mapped_column(String(20), default="", server_default="")
    tax_code: Mapped[str] = mapped_column(String(20), default="", server_default="")
    address: Mapped[str] = mapped_column(String(200))
    zip: Mapped[str] = mapped_column(String(12))
    city: Mapped[str] = mapped_column(String(80))
    province: Mapped[str] = mapped_column(String(3), default="", server_default="")
    country: Mapped[str] = mapped_column(String(2), default="IT", server_default="IT")
    sdi_code: Mapped[str] = mapped_column(String(7), default="", server_default="")
    pec: Mapped[str] = mapped_column(String(160), default="", server_default="")
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class BillingEvent(Base):
    """Stripe events already handled: the id makes webhook delivery idempotent."""

    __tablename__ = "billing_events"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(12), default="done", server_default="done")
    error: Mapped[str | None] = mapped_column(String(200))
    received_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class BillingPayment(Base):
    __tablename__ = "billing_payments"
    __table_args__ = (
        Index("ix_billing_payments_workspace", "workspace_id"),
        Index("ix_billing_payments_paid_at", "paid_at"),
    )
    invoice_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(16))  # paid | failed
    plan_id: Mapped[str | None] = mapped_column(String(24))
    document_url: Mapped[str | None] = mapped_column(String(2048))
    profile: Mapped[dict | None] = mapped_column(JSON)  # billing data at payment time
    paid_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class BillingMail(Base):
    """Transactional email outbox; `event_key` makes each mail sendable once."""

    __tablename__ = "billing_mail"
    __table_args__ = (Index("ix_billing_mail_pending", "state", "due_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    event_key: Mapped[str] = mapped_column(String(160), unique=True)
    kind: Mapped[str] = mapped_column(String(24))
    state: Mapped[str] = mapped_column(String(8), default="pending", server_default="pending")
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    due_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(TS)
