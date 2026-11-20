"""Public contact form: rate limited, honeypot, sent to the support address (never stored)."""

import html
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .auth.service import client_ip, rate_limit, too_many
from .core.config import get_settings
from .core.database import get_session
from .mail.mailer import send_email

router = APIRouter(prefix="/api/public", tags=["contact"])
log = logging.getLogger("vorya_qr.contact")


class ContactIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(max_length=254, pattern=r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")
    message: str = Field(min_length=10, max_length=3000)
    accept_privacy: bool
    hp: str = Field(default="", max_length=64)  # honeypot


def deliver(payload: ContactIn) -> None:
    support = get_settings().support_email
    body = (
        f"Nuovo messaggio dal sito\n\nNome: {payload.name}\nEmail: {payload.email}\n\n"
        f"{payload.message}"
    )
    try:
        send_email(
            support,
            f"Contatto dal sito · {payload.name[:60]}",
            body,
            f"<pre style='font-family:inherit;white-space:pre-wrap'>{html.escape(body)}</pre>",
            kind="contact",
            reply_to=payload.email,
        )
    except Exception:  # noqa: BLE001
        log.warning("Contact message could not be sent")


@router.post("/contact", status_code=202)
def contact(
    payload: ContactIn,
    request: Request,
    tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    if payload.hp:  # a bot: pretend everything went fine
        return {"message": "Messaggio inviato."}
    if not payload.accept_privacy:
        raise HTTPException(422, "Per inviare il messaggio accetta l'informativa privacy.")
    if not rate_limit(session, "contact-ip", client_ip(request), 5, 3600) or not rate_limit(
        session, "contact-email", payload.email.lower(), 3, 3600
    ):
        raise too_many(3600)
    tasks.add_task(deliver, payload)
    return {"message": "Messaggio inviato. Ti rispondiamo il prima possibile."}
