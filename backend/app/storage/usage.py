"""Storage usage per workspace. Files arrive with the storage module (0.2 block 2)."""

from sqlalchemy.orm import Session


def storage_used(session: Session, workspace_id: int) -> int:
    return 0


def company_storage(session: Session, company_id: int) -> int:
    return 0


def move_company_files(session: Session, company_id: int, workspace_id: int) -> None:
    """Files are owned by the company; their denormalized workspace_id follows it."""
    return None


def purge_company_files(session: Session, company_id: int) -> None:
    return None
