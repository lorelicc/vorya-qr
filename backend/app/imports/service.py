"""Import jobs: preview, atomic creation, ZIP rendering and CSV export of links."""

import csv
import io
import re
import zipfile
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..abuse.checks import flagged_urls
from ..core.csvsafe import safe_row
from ..core.errors import CodedError, QuotaExceeded
from ..core.security import now
from ..models import (
    Company,
    Folder,
    ImportJob,
    LinkAlias,
    LinkTag,
    LinkVersion,
    QrCode,
    QrPage,
    StylePreset,
    Tag,
)  # fmt: skip
from ..plans import features_of, locked, plan_of
from ..qr.design_service import apply_design
from ..qr.render import new_slug, root_link, short_link
from ..quotas import counts, dynamic_per_company, limits, lock_workspace
from ..schemas.design import QrDesign
from .parser import TEMPLATE_HEADER, TEMPLATE_ROWS, build_context, validate_file

RESULT_TTL = timedelta(days=7)
PALETTE = ["#087f5b", "#4b3fa0", "#b42334", "#8a5a00", "#0b6bcb", "#6b7280"]


def template_csv() -> bytes:
    """UTF-8 with BOM and ';' so Italian Excel opens it correctly."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(TEMPLATE_HEADER)
    writer.writerows(TEMPLATE_ROWS)
    return b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")


def feature_limit(session: Session, workspace) -> int:
    rows = features_of(plan_of(session, workspace)).max_bulk_rows
    if not rows:
        raise locked("L'importazione massiva da CSV")
    return rows


def batch_message(
    session: Session, workspace, dynamic: int, static: int, company_id: int | None = None
) -> str | None:
    """None if the whole batch fits; otherwise how many rows exceed the plan."""
    plan = plan_of(session, workspace)
    current, maximum = counts(session, workspace.id), limits(plan)
    per_company = dynamic_per_company(session, workspace.id).get(company_id, 0)
    problems = []
    for key, used, add, label in (
        ("dynamic", per_company, dynamic, "link e QR dinamici dell'azienda"),
        ("static", current.static, static, "QR statici"),
    ):
        limit = maximum[key]
        if limit is not None and add and used + add > limit:
            over = used + add - max(limit, used) if used <= limit else add
            problems.append(
                f"{over} righe superano il limite di {label} del piano "
                f"({used} usati su {limit}, il file ne aggiunge {add})"
            )
    return ". ".join(problems) + ". Non è stato creato nulla." if problems else None


def preview(session: Session, ctx, raw: bytes, fmt: str, size: int) -> ImportJob:
    workspace, company = ctx.workspace, ctx.company
    max_rows = feature_limit(session, workspace)
    plan = plan_of(session, workspace)
    context = build_context(session, workspace, company, plan)
    rows, errors, total, shown = validate_file(context, raw, max_rows)
    if not errors:  # reputation check once for all URLs, in batches of 500
        bad = flagged_urls([u for r in rows for u in r["urls"]])
        for row in rows:
            if any(u in bad for u in row["urls"]):
                errors.append({"row": row["row"], "column": "destinazione",
                               "message": "Destinazione segnalata come pericolosa (phishing o malware)."})  # fmt: skip
    for row in rows:
        row.pop("urls", None)
    dynamic = sum(1 for r in rows if r["kind"] == "dynamic")
    summary = batch_message(session, workspace, dynamic, len(rows) - dynamic, company.id)
    if summary and not errors:
        errors.append({"row": 0, "column": "quota", "message": summary})
    job = ImportJob(
        company_id=company.id, user_id=ctx.user.id, fmt=fmt, size=size, total=total,
        status="invalid" if errors else "validated", rows=rows if not errors else None,
        errors=errors, preview=shown,
    )  # fmt: skip
    session.add(job)
    session.flush()
    return job


def _folder_ids(session: Session, company_id: int, paths: set[tuple[str, ...]]) -> dict:
    """Finds or creates the folders named by the rows (at most 2 levels)."""
    existing = {(f.parent_id, f.name.lower()): f for f in session.scalars(
        select(Folder).where(Folder.company_id == company_id))}  # fmt: skip
    total = len(existing)
    ids: dict[tuple[str, ...], int] = {}
    for path in sorted(paths):
        parent = None
        for depth, name in enumerate(path):
            key = (parent, name.lower())
            if key not in existing:
                total += 1
                if total > 200:
                    raise CodedError(409, "Massimo 200 cartelle per azienda.", "quota_folders")
                folder = Folder(company_id=company_id, parent_id=parent, name=name, position=total)
                session.add(folder)
                session.flush()
                existing[key] = folder
            parent = existing[key].id
            ids[path[: depth + 1]] = parent
    return ids


def _tag_ids(session: Session, company_id: int, names: set[str]) -> dict[str, int]:
    found = {
        t.name.lower(): t for t in session.scalars(select(Tag).where(Tag.company_id == company_id))
    }
    for name in sorted(names):
        if name.lower() not in found:
            if len(found) >= 200:
                raise CodedError(409, "Massimo 200 tag per azienda.", "quota_tags")
            tag = Tag(company_id=company_id, name=name, color=PALETTE[len(found) % len(PALETTE)])
            session.add(tag)
            session.flush()
            found[name.lower()] = tag
    return {k: v.id for k, v in found.items()}


def _slugs(session: Session, n: int) -> list[str]:
    """n unused slugs, checked against slugs and back-halves in two queries per round."""
    out: list[str] = []
    while len(out) < n:
        batch = {new_slug() for _ in range(n - len(out))} - set(out)
        taken = set(session.scalars(select(QrCode.slug).where(QrCode.slug.in_(batch))))
        taken |= {a.lower() for a in session.scalars(select(LinkAlias.alias).where(
            LinkAlias.alias.in_({s.lower() for s in batch})))}  # fmt: skip
        out += list(batch - taken)
    return out[:n]


def create_all(session: Session, ctx, job: ImportJob) -> list[int]:
    """Creates every row in the current transaction. The caller holds the workspace lock."""
    rows, company, workspace = job.rows, ctx.company, ctx.workspace
    folders = _folder_ids(session, company.id, {tuple(r["folder"]) for r in rows if r["folder"]})
    tags = _tag_ids(session, company.id, {t for r in rows for t in r["tags"]})
    presets = {p.id: p for p in session.scalars(select(StylePreset).where(
        StylePreset.company_id == company.id))}  # fmt: skip
    slugs = iter(_slugs(session, sum(1 for r in rows if r["kind"] == "dynamic")))
    created: list[QrCode] = []
    for r in rows:
        design = QrDesign.model_validate(presets[r["style"]].design) if r["style"] else QrDesign()
        qr = QrCode(
            workspace_id=workspace.id, company_id=company.id, status="active", name=r["name"],
            kind=r["kind"], qr_type=r["qr_type"], target_url=r["target_url"],
            destination="page" if r["page"] else "redirect", static_data=r["static_data"],
            has_qr=r["has_qr"], slug=next(slugs) if r["kind"] == "dynamic" else None,
            folder_id=folders.get(tuple(r["folder"])) if r["folder"] else None,
        )  # fmt: skip
        apply_design(qr, design)
        session.add(qr)
        created.append(qr)
    session.flush()
    for r, qr in zip(rows, created, strict=True):
        if r["page"]:
            session.add(QrPage(qr_code_id=qr.id, template="vcard", document=r["page"]))
        if qr.kind == "dynamic":
            session.add(LinkVersion(
                qr_code_id=qr.id, number=1, qr_type=qr.qr_type, destination=qr.destination,
                target_url=qr.target_url, page=r["page"], file_ids=[], author_id=ctx.user.id,
                change="created",
            ))  # fmt: skip
        if r["alias"]:
            session.add(LinkAlias(qr_code_id=qr.id, workspace_id=workspace.id, alias=r["alias"]))
        for name in r["tags"]:
            session.add(LinkTag(qr_code_id=qr.id, tag_id=tags[name.lower()]))
    session.flush()
    return [qr.id for qr in created]


def confirm(session: Session, ctx, job: ImportJob) -> ImportJob:
    if job.status != "validated" or job.company_id != ctx.company.id:
        raise CodedError(409, "Questa importazione non può essere confermata.", "not_confirmable")
    workspace = lock_workspace(session, ctx.workspace.id)
    dynamic = sum(1 for r in job.rows if r["kind"] == "dynamic")
    message = batch_message(session, workspace, dynamic, len(job.rows) - dynamic, ctx.company.id)
    if message:  # all or nothing: the lock guarantees nobody took the last slots meanwhile
        raise QuotaExceeded(message, "quota_import")
    job.created_ids = create_all(session, ctx, job)
    job.rows = job.preview = None
    job.total = len(job.created_ids)
    if job.fmt == "none" or not any(r.has_qr for r in session.scalars(
            select(QrCode).where(QrCode.id.in_(job.created_ids)))):  # fmt: skip
        job.status, job.finished_at = "done", now()
    else:
        job.status = "queued"
    return job


def job_out(job: ImportJob) -> dict:
    return {
        "id": job.id, "status": job.status, "format": job.fmt, "total": job.total,
        "processed": job.processed, "errors": job.errors or [], "error": job.error,
        "has_result": bool(job.result_key), "created": len(job.created_ids or []),
        "created_at": job.created_at, "finished_at": job.finished_at,
        "preview": job.preview if job.status in ("validated", "invalid") else None,
    }  # fmt: skip


def safe(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:50] or "qr"


def build_zip(session: Session, job: ImportJob, on_progress) -> bytes:
    """Renders every QR of the import into one ZIP, plus a summary CSV with the short URLs."""
    from ..qr.design_service import design_of, render
    from ..qr.designer import svg_to_pdf, svg_to_png
    from ..qr.service import encoded_content_of

    links = {q.id: q for q in session.scalars(select(QrCode).where(QrCode.id.in_(job.created_ids)))}
    summary = io.StringIO()
    writer = csv.writer(summary, delimiter=";")
    writer.writerow(["riga", "nome", "tipo", "url_breve", "url_root", "back_half", "file"])
    aliases = dict(session.execute(
        select(LinkAlias.qr_code_id, LinkAlias.alias).where(LinkAlias.qr_code_id.in_(job.created_ids))
    ).all())  # fmt: skip
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for position, qr_id in enumerate(job.created_ids, start=1):
            qr = links[qr_id]
            file = ""
            if qr.has_qr:
                svg = render(session, qr.company_id, encoded_content_of(qr), design_of(qr))
                data = {"svg": lambda s=svg: s.encode(), "pdf": lambda s=svg: svg_to_pdf(s),
                        "png": lambda s=svg: svg_to_png(s, job.size)}[job.fmt]()  # fmt: skip
                file = f"{position:04d}-{safe(qr.name)}.{job.fmt}"
                archive.writestr(file, data)
            cells = [position, qr.name, qr.qr_type, short_link(qr.slug) if qr.slug else "",
                     root_link(aliases.get(qr.id) or qr.slug) if qr.slug else "",
                     aliases.get(qr.id, ""), file]  # fmt: skip
            writer.writerow(safe_row(cells))
            if position % 20 == 0 or position == len(job.created_ids):
                on_progress(position)
        archive.writestr("riepilogo.csv", b"\xef\xbb\xbf" + summary.getvalue().encode("utf-8"))
    return buffer.getvalue()


def export_csv(session: Session, company: Company, links: list[QrCode]) -> bytes:
    """All links of the company (filters already applied by the caller)."""
    ids = [q.id for q in links]
    aliases: dict[int, list[str]] = {}
    for qr_id, alias in session.execute(select(LinkAlias.qr_code_id, LinkAlias.alias).where(
            LinkAlias.qr_code_id.in_(ids), LinkAlias.removed_at.is_(None))):  # fmt: skip
        aliases.setdefault(qr_id, []).append(alias)
    tag_names: dict[int, list[str]] = {}
    for qr_id, name in session.execute(select(LinkTag.qr_code_id, Tag.name).join(
            Tag, Tag.id == LinkTag.tag_id).where(LinkTag.qr_code_id.in_(ids))):  # fmt: skip
        tag_names.setdefault(qr_id, []).append(name)
    folders = {
        f.id: f for f in session.scalars(select(Folder).where(Folder.company_id == company.id))
    }

    def path(folder_id):
        folder = folders.get(folder_id)
        if folder is None:
            return ""
        parent = folders.get(folder.parent_id)
        return f"{parent.name}/{folder.name}" if parent else folder.name

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["nome", "tipo", "formato", "url_breve", "url_root", "destinazione",
                     "back_half", "cartella", "tag", "stato", "scansioni", "creato"])  # fmt: skip
    for q in links:
        kind = "link breve" if q.kind == "dynamic" and not q.has_qr else (
            "QR dinamico" if q.kind == "dynamic" else "QR statico")  # fmt: skip
        cells = [q.name, q.qr_type, kind, short_link(q.slug) if q.slug else "",
                 root_link(q.slug) if q.slug else "", q.target_url, "|".join(aliases.get(q.id, [])),
                 path(q.folder_id), "|".join(sorted(tag_names.get(q.id, []))), q.status,
                 q.scan_total, q.created_at.date().isoformat()]  # fmt: skip
        writer.writerow(safe_row(cells))
    return b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")
