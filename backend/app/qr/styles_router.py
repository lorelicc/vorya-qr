"""Style presets: saved designs per company, limited per plan (total per workspace)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth.deps import CompanyContext, owned_company
from ..core.database import get_session
from ..core.errors import QuotaExceeded
from ..models import Company, StylePreset
from ..plans import features_of, plan_of
from ..quotas import lock_workspace
from ..schemas.design import QrDesign
from .design_service import apply_design, logo_png
from .service import get_owned, qr_out

router = APIRouter(prefix="/api/companies/{company_id}", tags=["styles"])


class PresetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)
    design: QrDesign


class ApplyStyle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    style_id: int


def preset_out(p: StylePreset) -> dict:
    return {"id": p.id, "name": p.name, "design": p.design, "created_at": p.created_at}


def owned_preset(session: Session, ctx: CompanyContext, style_id: int) -> StylePreset:
    preset = session.scalar(
        select(StylePreset).where(
            StylePreset.id == style_id, StylePreset.company_id == ctx.company.id
        )
    )
    if preset is None:
        raise HTTPException(404, "Stile non trovato.")
    return preset


@router.get("/styles")
def list_styles(
    ctx: CompanyContext = Depends(owned_company), session: Session = Depends(get_session)
):
    presets = session.scalars(
        select(StylePreset).where(StylePreset.company_id == ctx.company.id).order_by(StylePreset.id)
    )
    return [preset_out(p) for p in presets]


@router.post("/styles", status_code=201)
def create_style(payload: PresetIn, ctx: CompanyContext = Depends(owned_company),
                 session: Session = Depends(get_session)):  # fmt: skip
    workspace = lock_workspace(session, ctx.workspace.id)
    limit = features_of(plan_of(session, workspace)).max_style_presets
    used = session.scalar(
        select(func.count())
        .select_from(StylePreset)
        .join(Company, Company.id == StylePreset.company_id)
        .where(Company.workspace_id == workspace.id)
    )
    if limit is not None and used >= limit:
        raise QuotaExceeded(
            f"Hai raggiunto il numero massimo di stili salvati del piano ({limit}).", "quota_styles"
        )
    logo_png(session, ctx.company.id, payload.design)  # the logo must belong to the company
    preset = StylePreset(company_id=ctx.company.id, name=payload.name.strip(),
                         design=payload.design.model_dump(mode="json"))  # fmt: skip
    session.add(preset)
    session.commit()
    return preset_out(preset)


@router.put("/styles/{style_id}")
def update_style(style_id: int, payload: PresetIn, ctx: CompanyContext = Depends(owned_company),
                 session: Session = Depends(get_session)):  # fmt: skip
    preset = owned_preset(session, ctx, style_id)
    logo_png(session, ctx.company.id, payload.design)
    preset.name, preset.design = payload.name.strip(), payload.design.model_dump(mode="json")
    session.commit()
    return preset_out(preset)


@router.delete("/styles/{style_id}", status_code=204)
def delete_style(style_id: int, ctx: CompanyContext = Depends(owned_company),
                 session: Session = Depends(get_session)):  # fmt: skip
    session.delete(owned_preset(session, ctx, style_id))
    session.commit()


@router.post("/qr-codes/{qr_id}/apply-style")
def apply_style(qr_id: int, payload: ApplyStyle, ctx: CompanyContext = Depends(owned_company),
                session: Session = Depends(get_session)):  # fmt: skip
    from .design_service import render, require_scannable
    from .service import encoded_content_of

    qr = get_owned(session, ctx, qr_id, lock=True, edit=True)
    preset = owned_preset(session, ctx, payload.style_id)
    design = QrDesign.model_validate(preset.design)
    content = encoded_content_of(qr)
    require_scannable(content, design, render(session, ctx.company.id, content, design))
    apply_design(qr, design)
    session.commit()
    return qr_out(qr)
