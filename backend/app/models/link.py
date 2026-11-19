from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class LinkAlias(Base):
    """Custom back-half: an extra name for a link, never a replacement of its slug."""

    __tablename__ = "link_aliases"
    __table_args__ = (Index("ix_link_aliases_qr", "qr_code_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    qr_code_id: Mapped[int] = mapped_column(ForeignKey("qr_codes.id", ondelete="CASCADE"))
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    alias: Mapped[str] = mapped_column(String(50), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UtmTemplate(Base):
    __tablename__ = "utm_templates"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    source: Mapped[str] = mapped_column(String(100), default="")
    medium: Mapped[str] = mapped_column(String(100), default="")
    campaign: Mapped[str] = mapped_column(String(100), default="")
    term: Mapped[str] = mapped_column(String(100), default="")
    content: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
