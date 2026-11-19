from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class Company(Base):
    """A brand inside a workspace. QR codes, presets, files and stats belong to a company."""

    __tablename__ = "companies"
    __table_args__ = (Index("ix_companies_workspace_deleted", "workspace_id", "deleted_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    name: Mapped[str] = mapped_column(String(120))
    logo_file_id: Mapped[str | None] = mapped_column(String(36))
    primary_color: Mapped[str] = mapped_column(String(7), default="#087f5b")
    secondary_color: Mapped[str] = mapped_column(String(7), default="#00e99a")
    sector: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | purged
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purge_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CompanyTransfer(Base):
    __tablename__ = "company_transfers"
    __table_args__ = (
        Index(
            "uq_company_transfers_pending",
            "company_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
        Index("ix_company_transfers_to", "to_workspace_id", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    from_workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    to_workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"))
    to_email: Mapped[str] = mapped_column(String(254))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # pending | accepted | declined | cancelled | expired
    status: Mapped[str] = mapped_column(String(16), default="pending")
    failure_reason: Mapped[str | None] = mapped_column(String(300))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
