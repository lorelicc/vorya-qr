from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
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


class LinkVersion(Base):
    """A saved content state of a dynamic link: type, content JSON, linked files, author."""

    __tablename__ = "link_versions"
    __table_args__ = (
        UniqueConstraint("qr_code_id", "number", name="uq_link_versions_number"),
        Index("ix_link_versions_qr_created", "qr_code_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    qr_code_id: Mapped[int] = mapped_column(ForeignKey("qr_codes.id", ondelete="CASCADE"))
    number: Mapped[int] = mapped_column(Integer)
    qr_type: Mapped[str] = mapped_column(String(16))
    destination: Mapped[str] = mapped_column(String(8))
    target_url: Mapped[str] = mapped_column(String(2048), default="")
    page: Mapped[dict | None] = mapped_column(JSON)
    file_ids: Mapped[list] = mapped_column(JSON, default=list)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    change: Mapped[str] = mapped_column(
        String(12), default="content"
    )  # created|content|type|destination|restore
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
