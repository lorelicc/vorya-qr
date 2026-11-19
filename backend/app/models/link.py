from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
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


class Folder(Base):
    """A company folder; at most two levels (folder > sub-folder)."""

    __tablename__ = "folders"
    __table_args__ = (Index("ix_folders_company", "company_id", "parent_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("folders.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        Index("uq_tags_company_name", "company_id", func.lower(text("name")), unique=True),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(40))
    color: Mapped[str] = mapped_column(String(7), default="#087f5b")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LinkTag(Base):
    __tablename__ = "link_tags"
    __table_args__ = (Index("ix_link_tags_tag", "tag_id"),)
    qr_code_id: Mapped[int] = mapped_column(
        ForeignKey("qr_codes.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)


class ImportJob(Base):
    """A bulk creation from CSV: validated rows, then atomic creation, then ZIP rendering."""

    __tablename__ = "import_jobs"
    __table_args__ = (
        Index("ix_import_jobs_company", "company_id", "created_at"),
        Index("ix_import_jobs_status", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(12))  # validated|invalid|queued|running|done|failed
    fmt: Mapped[str] = mapped_column(String(4), default="png", server_default="png")
    size: Mapped[int] = mapped_column(Integer, default=1024, server_default="1024")
    total: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    processed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    rows: Mapped[list | None] = mapped_column(JSON)
    preview: Mapped[list | None] = mapped_column(JSON)  # raw cells of the first rows, for the UI
    errors: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    created_ids: Mapped[list] = mapped_column(JSON, default=list, server_default="[]")
    result_key: Mapped[str | None] = mapped_column(String(80))
    error: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
