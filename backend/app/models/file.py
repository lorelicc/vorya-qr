from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class StoredFile(Base):
    """An uploaded file and its variants. size_bytes is the total of all stored variants."""

    __tablename__ = "files"
    __table_args__ = (
        Index("ix_files_workspace_deleted", "workspace_id", "deleted_at"),
        Index("ix_files_company", "company_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    qr_code_id: Mapped[int | None] = mapped_column(
        ForeignKey("qr_codes.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(String(8))  # image | pdf | audio
    purpose: Mapped[str] = mapped_column(String(16))
    mime: Mapped[str] = mapped_column(String(40))
    original_name: Mapped[str] = mapped_column(String(200))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    variants: Mapped[dict] = mapped_column(JSON, default=dict)
    page_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purge_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
