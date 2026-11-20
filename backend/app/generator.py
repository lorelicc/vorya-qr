"""Free public QR generator (no account) and the anonymous site counters.

Static QR codes only: the content is written in the QR, so it works forever. Nothing is stored
about the visitor: the endpoints keep no QR, no file and no IP (hashed only as a rate-limit key);
the only thing saved is an aggregate daily counter per event / type / landing page.
"""

import base64
import binascii
import io
import re
import threading
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .auth.service import client_ip, rate_limit, too_many
from .core.database import get_session
from .core.errors import CodedError
from .core.security import now
from .models import GeneratorCounter, PlatformSetting, QrCode
from .qr.designer import logo_as_png, render_svg, svg_to_png
from .qr.scan_check import check
from .qr.static_types import encode_static
from .schemas.design import Logo, QrDesign

router = APIRouter(prefix="/api/public/generator", tags=["generator"])
site_router = APIRouter(prefix="/api/public/site", tags=["site"])

TYPES = ("website", "text", "wifi", "email", "sms", "phone", "whatsapp", "vcard_static")
MAX_BODY = 450_000
LOGO_MAX_BYTES = 256 * 1024
LOGO_MAX_SIDE = 2048
LOGO_URL = re.compile(r"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$")
LANDING = re.compile(r"^/[a-z0-9/_-]{0,60}$")
PLACEHOLDER_LOGO_ID = "00000000-0000-0000-0000-000000000000"
SLOTS = threading.BoundedSemaphore(4)  # CPU-bound rendering: never more than 4 at once
Type = Literal["website", "text", "wifi", "email", "sms", "phone", "whatsapp", "vcard_static"]


class GeneratorIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Type
    data: dict = Field(default_factory=dict)
    design: QrDesign = Field(default_factory=QrDesign)
    logo: str | None = Field(default=None, max_length=LOGO_MAX_BYTES * 2)  # data URL, memory only
    landing: str = Field(default="/genera", max_length=64)
    hp: str = Field(default="", max_length=64)  # honeypot: real users never fill it


class DownloadIn(GeneratorIn):
    format: Literal["png", "svg"] = "png"
    size: int = Field(default=1024, ge=256, le=2048)


class TrackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: Literal["view"]
    type: str = Field(default="", max_length=16)
    landing: str = Field(default="/", max_length=64)


def small_body(request: Request) -> None:
    length = request.headers.get("content-length")
    if not length or not length.isdigit() or int(length) > MAX_BODY:
        raise HTTPException(413, "Richiesta troppo grande.")


def landing_of(value: str) -> str:
    return value if LANDING.match(value) else "/"


def bump(session: Session, event: str, qr_type: str, landing: str) -> None:
    session.execute(
        insert(GeneratorCounter)
        .values(day=date.today(), event=event, qr_type=qr_type[:16], landing=landing, count=1)
        .on_conflict_do_update(
            index_elements=["day", "event", "qr_type", "landing"],
            set_={"count": GeneratorCounter.count + 1},
        )
    )
    session.commit()


def logo_png(data_url: str | None) -> bytes | None:
    """The uploaded logo lives in memory only: validated, converted, never written anywhere."""
    if not data_url:
        return None
    match = LOGO_URL.match(data_url)
    if not match:
        raise CodedError(422, "Il logo deve essere un'immagine PNG, JPG o WebP.", "bad_logo")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise CodedError(422, "Logo non valido.", "bad_logo") from None
    if len(raw) > LOGO_MAX_BYTES:
        raise CodedError(422, "Il logo supera i 256 KB: usa un'immagine più piccola.", "bad_logo")
    from PIL import Image

    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()
        image = Image.open(io.BytesIO(raw))
        if max(image.size) > LOGO_MAX_SIDE:
            raise CodedError(422, "Il logo è troppo grande (massimo 2048 px).", "bad_logo")
        return logo_as_png(raw)
    except CodedError:
        raise
    except Exception:  # noqa: BLE001 - any decoding problem is just "not a valid image"
        raise CodedError(422, "Logo non valido.", "bad_logo") from None


def build(payload: GeneratorIn) -> tuple[str, QrDesign, bytes | None]:
    if payload.hp:
        raise HTTPException(400, "Richiesta non valida.")
    try:
        content = encode_static(payload.type, payload.data)
    except ValidationError as exc:
        first = exc.errors()[0]
        message = str(first.get("msg", "Contenuto non valido")).removeprefix("Value error, ")
        raise CodedError(422, message, "invalid_content") from None
    png = logo_png(payload.logo)
    design = payload.design
    if png is None:
        design = design.model_copy(update={"logo": None})
    elif design.logo is None:
        design = design.model_copy(update={"logo": Logo(file_id=PLACEHOLDER_LOGO_ID)})
    else:
        design = design.model_copy(
            update={"logo": design.logo.model_copy(update={"file_id": PLACEHOLDER_LOGO_ID})}
        )
    design = QrDesign.model_validate(design.model_dump())  # logo forces correction H
    return content, design, png


def render_guarded(content: str, design: QrDesign, png: bytes | None) -> str:
    if not SLOTS.acquire(timeout=3):
        raise HTTPException(503, "Il generatore è molto richiesto: riprova tra un istante.")
    try:
        try:
            return render_svg(content, design, png)
        except (ValueError, OverflowError):
            raise CodedError(
                422, "Il contenuto è troppo lungo per un QR leggibile: accorcialo.", "too_long"
            ) from None
    finally:
        SLOTS.release()


@router.post("/preview", dependencies=[Depends(small_body)])
def preview(payload: GeneratorIn, request: Request, session: Session = Depends(get_session)):
    if not rate_limit(session, "gen-preview", client_ip(request), 90, 600):
        raise too_many(600)
    content, design, png = build(payload)
    svg = render_guarded(content, design, png)
    bump(session, "preview", payload.type, landing_of(payload.landing))
    return {
        "svg": svg,
        "content": content,
        "static": True,
        "scannability": check(content, design, svg),
    }


@router.post("/download", dependencies=[Depends(small_body)])
def download(payload: DownloadIn, request: Request, session: Session = Depends(get_session)):
    if not rate_limit(session, "gen-download", client_ip(request), 30, 600):
        raise too_many(600)
    content, design, png = build(payload)
    svg = render_guarded(content, design, png)
    result = check(content, design, svg)
    if not result["scannable"]:
        blocking = [r["message"] for r in result["reasons"] if r["blocking"]]
        raise CodedError(422, " ".join(blocking), "unscannable")
    bump(session, "download", payload.type, landing_of(payload.landing))
    name = f"qr-{payload.type}.{payload.format}"
    headers = {"Content-Disposition": f'attachment; filename="{name}"', "Cache-Control": "no-store"}
    if payload.format == "svg":
        return Response(svg, media_type="image/svg+xml", headers=headers)
    with SLOTS:
        data = svg_to_png(svg, payload.size)
    return Response(data, media_type="image/png", headers=headers)


@router.post("/track", status_code=204)
def track(payload: TrackIn, request: Request, session: Session = Depends(get_session)):
    """One anonymous "generator viewed" count per page load (aggregate only)."""
    if not rate_limit(session, "gen-track", client_ip(request), 120, 600):
        raise too_many(600)
    bump(
        session, "view", payload.type if payload.type in TYPES else "", landing_of(payload.landing)
    )


@site_router.get("/counters")
def counters(session: Session = Depends(get_session)):
    """Public numbers, read from the real database and shown only above the admin threshold."""
    row = session.get(PlatformSetting, "site")
    threshold = int((row.data if row else {}).get("counter_threshold", 1000))
    created = session.scalar(select(func.count()).select_from(QrCode)) or 0
    downloads = (
        session.scalar(
            select(func.coalesce(func.sum(GeneratorCounter.count), 0)).where(
                GeneratorCounter.event == "download"
            )
        )
        or 0
    )
    total = created + downloads
    return {"qr_created": total if total >= threshold else None, "as_of": now().date().isoformat()}
