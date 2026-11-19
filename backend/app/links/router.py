"""0.3 short links: quick creation from a pasted URL (no QR until "Genera QR")."""

from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..auth.service import audit, rate_limit
from ..core.database import get_session
from ..qr.service import insert_qr, qr_out
from ..quotas import reserve_slot
from ..schemas.qr import LinkQuickCreate, QrCreate, QrOut

router = APIRouter(prefix="/api/companies/{company_id}/links", tags=["links"])


@router.post("", response_model=QrOut, status_code=201)
def quick_create(
    payload: LinkQuickCreate,
    ctx: CompanyContext = Depends(owned_company),
    session: Session = Depends(get_session),
):
    if not rate_limit(session, "qr-create", str(ctx.workspace.id), 120, 3600):
        raise HTTPException(429, "Troppi link creati in poco tempo. Riprova più tardi.")
    url = payload.target_url.strip()
    name = " ".join(payload.name.split()) or (urlsplit(url).hostname or "Link")[:120]
    reserve_slot(session, ctx.workspace.id, "dynamic")  # links and dynamic QR share the quota
    body = QrCreate(name=name, qr_type="website", dynamic=True, has_qr=False, target_url=url)
    link = insert_qr(session, ctx, body)
    audit(session, ctx.user, "link.created", ctx.workspace.id, ctx.company.id, qr_id=link.id)
    session.commit()
    return qr_out(link)
