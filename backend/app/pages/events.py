"""Clicks on hosted pages: POST /api/public/pages/{slug}/events (sendBeacon).

The client sends only a block id and an item key; the human-readable label is computed here
from the saved page, so visitors cannot inject arbitrary text into the owner's statistics."""

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..auth.service import client_ip, rate_limit
from ..core.database import session_factory
from ..models import PageEvent, QrCode
from ..redirect.useragent import classify
from .public import load_page

router = APIRouter(prefix="/api/public/pages", tags=["public"])

CONTACT = {"web": "sito web", "vcf": "salva contatto"}
MUSIC = {"spotify": "Spotify", "apple_music": "Apple Music", "youtube_music": "YouTube Music",
         "amazon_music": "Amazon Music", "soundcloud": "SoundCloud"}  # fmt: skip
MAPS = {"google": "Google Maps", "apple": "Apple Maps"}


class ClickIn(BaseModel):
    block_id: str = Field(max_length=40)
    item: str = Field(default="", max_length=40)


def label_for(block, item: str) -> str | None:
    t = block.type
    if t == "button":
        return f"Pulsante: {block.label}"
    if t == "link_list" and item.isdigit() and int(item) < len(block.items):
        return f"Link: {block.items[int(item)].label}"
    if t == "contact":
        if item.startswith("tel"):
            return "Contatto: telefono"
        if item.startswith("mail"):
            return "Contatto: email"
        return f"Contatto: {CONTACT[item]}" if item in CONTACT else None
    if t == "file":
        action = "scarica" if item == "download" else "apri"
        return f"File: {block.label or 'documento'} ({action})"
    if t == "music_links" and item in MUSIC:
        return f"Musica: {MUSIC[item]}"
    if t == "gallery" and item.isdigit():
        return f"Galleria: immagine {int(item) + 1}"
    if t == "social_icons" and any(i.network == item for i in block.items):
        return f"Social: {item.replace('_', ' ').title()}"
    if t == "address":
        return f"Mappa: {MAPS.get(item, 'apri')}"
    return None


@router.post("/{slug}/events", status_code=204)
def page_event(slug: str, body: ClickIn, request: Request):
    page, _, _, _ = load_page(slug)
    block = next((b for b in page.blocks if b.id == body.block_id), None)
    label = label_for(block, body.item) if block else None
    info = classify(request.headers.get("user-agent", ""))
    if label is None or info.is_bot:
        return Response(status_code=204)
    with session_factory()() as session:
        if not rate_limit(session, "page-click", client_ip(request), 120):
            session.commit()
            return Response(status_code=204)  # silently dropped: beacons never retry
        qr_id = session.scalar(select(QrCode.id).where(QrCode.slug == slug))
        session.add(PageEvent(qr_code_id=qr_id, kind="click", label=label[:120],
                              device_type=info.device_type))  # fmt: skip
        session.commit()
    return Response(status_code=204)
