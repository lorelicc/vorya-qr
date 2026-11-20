from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base

TS = DateTime(timezone=True)


class ReportSettings(Base):
    __tablename__ = "report_settings"
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    weekly: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    monthly: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=func.now(), onupdate=func.now())


class ReportRecipient(Base):
    """An external person who receives a company's reports. Double opt-in, one-click unsubscribe."""

    __tablename__ = "report_recipients"
    __table_args__ = (
        UniqueConstraint("company_id", "email", name="uq_report_recipient"),
        Index("ix_report_recipients_confirm", "confirm_hash"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    email: Mapped[str] = mapped_column(String(254))
    confirm_hash: Mapped[str] = mapped_column(String(64))
    unsub_token: Mapped[str] = mapped_column(String(43), unique=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(TS)
    unsubscribed_at: Mapped[datetime | None] = mapped_column(TS)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())


class ReportLog(Base):
    """One report to one recipient: queued with a due time (spread over hours), then sent."""

    __tablename__ = "report_log"
    __table_args__ = (
        UniqueConstraint("recipient_id", "kind", "period_end", name="uq_report_period"),
        Index("ix_report_log_due", "state", "due_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("report_recipients.id", ondelete="CASCADE")
    )
    kind: Mapped[str] = mapped_column(String(8))  # weekly | monthly
    period_start: Mapped[datetime] = mapped_column(TS)
    period_end: Mapped[datetime] = mapped_column(TS)
    state: Mapped[str] = mapped_column(String(8), default="pending", server_default="pending")
    due_at: Mapped[datetime] = mapped_column(TS)
    sent_at: Mapped[datetime | None] = mapped_column(TS)
    error: Mapped[str | None] = mapped_column(String(80))


class MetricsSnapshot(Base):
    __tablename__ = "metrics_snapshots"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=func.now())
