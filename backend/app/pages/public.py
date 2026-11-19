"""Public data of hosted pages (no scan is counted here: /r/{slug} already counted it)."""

import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy import select

from ..access import redirects_enabled
from ..core.database import session_factory
from ..models import Company, Plan, QrCode, QrPage, StoredFile, Workspace
from ..plans import features_of
from ..schemas.page import Page
from .vcard import vcard

router = APIRouter(prefix="/api/public/pages", tags=["public"])
SLUG = re.compile(r"^[A-Za-z0-9]{7}$")


def load_page(slug: str):
    if not SLUG.match(slug):
        raise HTTPException(404, "Pagina non trovata.")
    with session_factory()() as session:
        row = session.execute(
            select(QrCode, QrPage, Company, Workspace)
            .join(QrPage, QrPage.qr_code_id == QrCode.id)
            .join(Company, Company.id == QrCode.company_id)
            .join(Workspace, Workspace.id == Company.workspace_id)
            .where(QrCode.slug == slug)
        ).one_or_none()
        if (
            row is None
            or row.QrCode.deleted_at
            or row.QrCode.status != "active"
            or row.Company.deleted_at
            or not redirects_enabled(row.Workspace.status)
        ):
            raise HTTPException(404, "Pagina non disponibile.")
        page = Page.model_validate(row.QrPage.document)
        ids = page.file_ids()
        files = {
            f.id: {
                "kind": f.kind,
                "urls": {n: f"/f/{f.id}/{n}" for n in f.variants},
                "name": f.original_name,
                "pages": f.page_count,
                "width": (f.variants.get("large") or {}).get("width"),
                "height": (f.variants.get("large") or {}).get("height"),
            }  # fmt: skip
            for f in session.scalars(
                select(StoredFile).where(StoredFile.id.in_(ids), StoredFile.deleted_at.is_(None))
            )
        }
        remove_branding = features_of(session.get(Plan, row.Workspace.plan_id)).remove_branding
        company = {
            "name": row.Company.name,
            "logo_url": f"/f/{row.Company.logo_file_id}/logo" if row.Company.logo_file_id else None,
        }
    return page, files, company, remove_branding


@router.get("/{slug}")
def public_page(slug: str):
    page, files, company, remove_branding = load_page(slug)
    data = page.model_dump(mode="json")
    # Branding can be hidden only when the plan allows it.
    data["settings"]["show_branding"] = page.settings.show_branding or not remove_branding
    return {"slug": slug, "page": data, "files": files, "company": company}


@router.get("/{slug}/vcard/{block_id}.vcf")
def download_vcard(slug: str, block_id: str):
    page, files, _, _ = load_page(slug)
    block = next((b for b in page.blocks if b.id == block_id and b.type == "contact"), None)
    if block is None:
        raise HTTPException(404, "Contatto non trovato.")
    name = re.sub(r"[^\w-]+", "-", f"{block.first_name} {block.last_name}".strip() or "contatto")
    return Response(
        vcard(block),
        media_type="text/vcard; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{name}.vcf"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
