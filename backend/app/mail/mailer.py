"""Central mail transport. No endpoint accepts arbitrary recipients or content.

- smtp: implicit TLS (ssl) or STARTTLS, certificate verified. Settings from env only (0.1).
- file: writes each message as JSON in MAIL_FILE_DIR. Refused in production by Settings;
        used by local development and end-to-end tests to read verification links.
"""

import json
import logging
import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from ..core.config import get_settings
from ..core.database import session_factory
from ..models import MailLog

logger = logging.getLogger(__name__)


class DeliveryError(Exception):
    pass


def _record(kind: str, success: bool, error: str | None = None) -> None:
    try:
        with session_factory()() as session:
            session.add(MailLog(kind=kind, success=success, error_code=error))
            session.commit()
    except Exception:  # noqa: BLE001 - logging must never break delivery
        logger.warning("Mail result could not be recorded")


def _smtp_send(message: EmailMessage) -> None:
    s = get_settings()
    if not (s.smtp_host and s.smtp_user and s.smtp_password.get_secret_value()):
        raise DeliveryError("SMTP non configurato")
    context = ssl.create_default_context()
    if s.smtp_security == "ssl":
        client = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=s.smtp_timeout, context=context)
    else:
        client = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=s.smtp_timeout)
        client.ehlo()
        client.starttls(context=context)
        client.ehlo()
    with client:
        client.login(s.smtp_user, s.smtp_password.get_secret_value())
        if client.send_message(message):
            raise DeliveryError("Destinatario rifiutato")


def _file_send(message: EmailMessage, recipient: str, kind: str, text: str) -> None:
    folder = Path(get_settings().mail_file_dir)
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"to": recipient, "kind": kind, "subject": message["Subject"], "text": text}
    (folder / f"{kind}-{uuid.uuid4().hex}.json").write_text(json.dumps(payload), encoding="utf-8")


def send_email(recipient: str, subject: str, text: str, html_body: str, kind: str) -> None:
    s = get_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((s.smtp_from_name, s.smtp_from_email))
    message["To"] = recipient
    message.set_content(text)
    message.add_alternative(html_body, subtype="html")
    try:
        if s.mail_transport == "file":
            _file_send(message, recipient, kind, text)
        else:
            _smtp_send(message)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Mail delivery failed (%s)", type(exc).__name__)
        _record(kind, False, type(exc).__name__[:64])
        return
    _record(kind, True)
