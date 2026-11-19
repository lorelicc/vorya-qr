from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.security import now
from ..models import Company, QrCode, ScanEvent
from ..schemas.company import CompanyOut

RESTORE_DAYS = 30


def logo_url(company: Company) -> str | None:
    return f"/f/{company.logo_file_id}/logo" if company.logo_file_id else None


def company_stats(session: Session, company_ids: list[int]) -> dict[int, tuple[int, int]]:
    """company_id -> (active QR count, human scans in the last 7 days)."""
    if not company_ids:
        return {}
    qr_rows = dict(
        session.execute(
            select(QrCode.company_id, func.count())
            .where(QrCode.company_id.in_(company_ids), QrCode.deleted_at.is_(None))
            .group_by(QrCode.company_id)
        ).all()
    )
    scan_rows = dict(
        session.execute(
            select(QrCode.company_id, func.count())
            .join(ScanEvent, ScanEvent.qr_code_id == QrCode.id)
            .where(
                QrCode.company_id.in_(company_ids),
                ScanEvent.is_bot.is_(False),
                ScanEvent.scanned_at >= now() - timedelta(days=7),
            )
            .group_by(QrCode.company_id)
        ).all()
    )
    return {cid: (qr_rows.get(cid, 0), scan_rows.get(cid, 0)) for cid in company_ids}


def company_out(company: Company, stats: tuple[int, int] = (0, 0)) -> CompanyOut:
    return CompanyOut(
        id=company.id,
        name=company.name,
        logo_url=logo_url(company),
        primary_color=company.primary_color,
        secondary_color=company.secondary_color,
        sector=company.sector,
        qr_count=stats[0],
        scans_7d=stats[1],
        created_at=company.created_at,
        deleted_at=company.deleted_at,
        purge_after=company.purge_after,
    )


def create_default_company(session: Session, workspace_id: int, name: str) -> Company:
    company = Company(workspace_id=workspace_id, name=name[:120])
    session.add(company)
    session.flush()
    return company
