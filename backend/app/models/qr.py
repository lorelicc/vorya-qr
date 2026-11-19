from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class QrCode(Base):
    __tablename__ = "qr_codes"
    __table_args__ = (Index("ix_qr_codes_workspace_deleted", "workspace_id", "deleted_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    # Denormalized owner, kept in sync with companies.workspace_id (quotas, redirect).
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(8))  # static | dynamic
    content_type: Mapped[str] = mapped_column(String(16), default="url")
    qr_type: Mapped[str] = mapped_column(String(16), default="website")
    destination: Mapped[str] = mapped_column(String(8), default="redirect")  # redirect | page
    static_data: Mapped[dict | None] = mapped_column(JSON)
    design: Mapped[dict | None] = mapped_column(JSON)
    target_url: Mapped[str] = mapped_column(String(2048))
    slug: Mapped[str | None] = mapped_column(String(16), unique=True)
    status: Mapped[str] = mapped_column(String(8), default="active")  # active|paused|blocked
    blocked_reason: Mapped[str | None] = mapped_column(String(200))  # set by an admin
    fg_color: Mapped[str] = mapped_column(String(7), default="#091411")
    bg_color: Mapped[str] = mapped_column(String(7), default="#ffffff")
    margin: Mapped[int] = mapped_column(Integer, default=4)
    error_correction: Mapped[str] = mapped_column(String(1), default="M")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ScanEvent(Base):
    """One scan of a dynamic QR. No IP address and no geolocation are ever stored."""

    __tablename__ = "scan_events"
    __table_args__ = (Index("ix_scan_events_qr_time", "qr_code_id", "scanned_at"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    qr_code_id: Mapped[int] = mapped_column(ForeignKey("qr_codes.id", ondelete="CASCADE"))
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    device_type: Mapped[str] = mapped_column(String(16))
    os: Mapped[str] = mapped_column(String(40))
    browser: Mapped[str] = mapped_column(String(40))
    referrer_host: Mapped[str | None] = mapped_column(String(255))
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False)
    # 0.2: approximate place from DB-IP Lite (the IP itself is discarded) and a daily-salted
    # hash used only to estimate unique visitors within one day.
    country_code: Mapped[str | None] = mapped_column(String(2))
    city: Mapped[str | None] = mapped_column(String(80))
    visitor_hash: Mapped[str | None] = mapped_column(String(16))


class PageEvent(Base):
    """A click on a hosted page (link, button, download). No visitor identifier at all."""

    __tablename__ = "page_events"
    __table_args__ = (Index("ix_page_events_qr_time", "qr_code_id", "created_at"),)
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    qr_code_id: Mapped[int] = mapped_column(ForeignKey("qr_codes.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    kind: Mapped[str] = mapped_column(String(16))
    label: Mapped[str] = mapped_column(String(120))
    device_type: Mapped[str] = mapped_column(String(16))


class DailySalt(Base):
    """Random salt for today's visitor hashes; older salts are deleted by the worker, which
    makes past hashes impossible to link to an IP or to each other across days."""

    __tablename__ = "daily_salts"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    salt: Mapped[bytes] = mapped_column(LargeBinary(32))


class QrPage(Base):
    """The hosted page of a dynamic QR (destination = page), as a validated JSON document."""

    __tablename__ = "qr_pages"
    qr_code_id: Mapped[int] = mapped_column(
        ForeignKey("qr_codes.id", ondelete="CASCADE"), primary_key=True
    )
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    template: Mapped[str] = mapped_column(String(16))
    document: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
