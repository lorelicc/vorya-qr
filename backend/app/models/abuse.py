from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class BlockedDomain(Base):
    """Destinations refused at creation and update (the domain and all its subdomains)."""

    __tablename__ = "blocked_domains"
    id: Mapped[int] = mapped_column(primary_key=True)
    domain: Mapped[str] = mapped_column(String(253), unique=True)
    reason: Mapped[str] = mapped_column(String(200), default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AbuseReport(Base):
    __tablename__ = "abuse_reports"
    __table_args__ = (Index("ix_abuse_reports_status", "status", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    slug: Mapped[str | None] = mapped_column(String(16))
    qr_code_id: Mapped[int | None] = mapped_column(ForeignKey("qr_codes.id", ondelete="SET NULL"))
    reason: Mapped[str] = mapped_column(String(16))
    details: Mapped[str] = mapped_column(Text, default="")
    reporter_email: Mapped[str | None] = mapped_column(String(254))
    status: Mapped[str] = mapped_column(String(16), default="open")
    resolution: Mapped[str | None] = mapped_column(String(24))
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
