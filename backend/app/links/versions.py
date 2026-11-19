"""Content version history of dynamic links and type changes.

Slug, aliases, QR design, rules and statistics never change with the content: only type,
target/page and files do. Each save creates a version; the worker keeps the last 20.
"""

from sqlalchemy import String, func, select
from sqlalchemy.orm import Session

from ..core.errors import CodedError
from ..models import LinkVersion, Plan, QrCode, QrPage, StoredFile, User
from ..plans import features_of, locked, require_type
from ..schemas.page import Page

KEEP = 20
HISTORY_CHANGES = ("type", "destination", "restore")  # shown as markers on the stats chart


def record_version(session: Session, qr: QrCode, author, change: str = "content") -> LinkVersion:
    page = session.get(QrPage, qr.id) if qr.destination == "page" else None
    number = (
        session.scalar(
            select(func.coalesce(func.max(LinkVersion.number), 0)).where(
                LinkVersion.qr_code_id == qr.id
            )
        )
        + 1
    )
    ids = sorted(Page.model_validate(page.document).file_ids()) if page else []
    version = LinkVersion(
        qr_code_id=qr.id, number=number, qr_type=qr.qr_type, destination=qr.destination,
        target_url=qr.target_url, page=page.document if page else None, file_ids=ids,
        author_id=author.id if author else None, change=change,
    )  # fmt: skip
    session.add(version)
    session.flush()
    return version


def require_history(session: Session, workspace) -> None:
    if not features_of(session.get(Plan, workspace.plan_id)).version_history:
        raise locked("La cronologia delle versioni")


def version_out(version: LinkVersion, authors: dict[int, str], detail: bool = False) -> dict:
    data = {
        "number": version.number,
        "qr_type": version.qr_type,
        "destination": version.destination,
        "target_url": version.target_url,
        "change": version.change,
        "author": authors.get(version.author_id),
        "created_at": version.created_at,
    }
    if detail:
        data["page"] = version.page
        data["file_ids"] = version.file_ids
    return data


def authors_of(session: Session, versions) -> dict[int, str]:
    ids = {v.author_id for v in versions if v.author_id}
    if not ids:
        return {}
    return dict(session.execute(select(User.id, User.display_name).where(User.id.in_(ids))).all())


def check_type_change(session: Session, workspace, qr: QrCode, new_type: str) -> tuple[str, str]:
    """(kind, destination) for the new type. Static QR codes can never change type."""
    from ..qr.service import kind_of

    if qr.kind == "static":
        raise CodedError(
            409, "Un QR statico non può cambiare tipo: crea un nuovo QR.", "static_type_locked"
        )
    kind, destination = kind_of(new_type, True)
    if kind != "dynamic":
        raise CodedError(422, "Questo tipo esiste solo come QR statico.", "static_type_unavailable")
    require_type(session.get(Plan, workspace.plan_id), new_type)
    return kind, destination


def apply_type(session: Session, qr: QrCode, new_type: str, destination: str) -> None:
    """Switches the type in place: slug, aliases, design, rules and statistics stay untouched."""
    leaving_page = qr.destination == "page" and destination != "page"
    qr.qr_type, qr.destination, qr.static_data = new_type, destination, None
    if destination == "redirect":
        qr.target_url = ""
    if leaving_page:
        row = session.get(QrPage, qr.id)
        if row is not None:  # the document lives on in the version history
            session.delete(row)


def prune(session: Session, link_ids: list[int] | None = None) -> int:
    """Keeps the last KEEP versions per link; files used only by pruned versions are removed."""
    from ..storage.usage import soft_delete

    over = (
        select(LinkVersion.qr_code_id).group_by(LinkVersion.qr_code_id).having(func.count() > KEEP)
    )
    if link_ids is not None:
        over = over.where(LinkVersion.qr_code_id.in_(link_ids))
    removed = 0
    for qr_id in session.scalars(over.limit(200)).all():
        versions = session.scalars(
            select(LinkVersion)
            .where(LinkVersion.qr_code_id == qr_id)
            .order_by(LinkVersion.number.desc())
        ).all()
        keep, drop = versions[:KEEP], versions[KEEP:]
        still_used = {f for v in keep for f in v.file_ids}
        page = session.get(QrPage, qr_id)
        if page is not None:
            still_used |= Page.model_validate(page.document).file_ids()
        candidates = {f for v in drop for f in v.file_ids} - still_used
        if candidates:
            owner_company = session.scalar(select(QrCode.company_id).where(QrCode.id == qr_id))
            docs = [
                d for (d,) in session.execute(
                    select(func.cast(QrPage.document, String))
                    .join(QrCode, QrCode.id == QrPage.qr_code_id)
                    .where(QrCode.company_id == owner_company, QrCode.id != qr_id)
                )
            ] + [
                d for (d,) in session.execute(
                    select(func.cast(LinkVersion.page, String))
                    .join(QrCode, QrCode.id == LinkVersion.qr_code_id)
                    .where(QrCode.company_id == owner_company, QrCode.id != qr_id,
                           LinkVersion.page.is_not(None))
                )
            ]  # fmt: skip
            for file in session.scalars(
                select(StoredFile).where(
                    StoredFile.id.in_(candidates),
                    StoredFile.qr_code_id == qr_id,
                    StoredFile.deleted_at.is_(None),
                )
            ):
                if not any(file.id in doc for doc in docs):
                    soft_delete(session, file)
        for version in drop:
            session.delete(version)
            removed += 1
    return removed
