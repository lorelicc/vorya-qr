"""From the free generator to a dynamic QR: creates the QR the visitor was making.

Runs when the email is verified, so the account never has to rebuild anything. It is strictly
best effort: whatever goes wrong, the signup itself must succeed. The logo is never carried over.
"""

import logging
from urllib.parse import urlsplit

from ..auth.deps import CompanyContext
from ..models import Company, User, Workspace
from ..qr.service import insert_qr
from ..schemas.design import QrDesign
from ..schemas.page import Page
from ..schemas.qr import QrCreate

log = logging.getLogger("vorya_qr.handoff")
THEME = {"primary": "#087f5b", "secondary": "#00e99a"}


def _design(raw: dict | None) -> QrDesign | None:
    if not raw:
        return None
    raw = {**raw, "logo": None}
    return QrDesign.model_validate(raw)


def create_from_handoff(session, user: User, workspace: Workspace, company: Company, handoff: dict):
    """Returns the new QR or None. Never raises."""
    try:
        with session.begin_nested():
            design = _design(handoff.get("design"))
            data = handoff["data"]
            if handoff["type"] == "website":
                url = data["url"]
                payload = QrCreate(
                    name=(urlsplit(url).hostname or "Il mio QR")[:120],
                    qr_type="website",
                    dynamic=True,
                    target_url=url,
                    design=design,
                )
            else:
                name = " ".join(p for p in (data.get("first_name"), data.get("last_name")) if p)
                name = name or data.get("organization") or "La mia vCard"
                phones = [{"label": "cell", "number": data["phone"]}] if data.get("phone") else []
                emails = [{"label": "work", "address": data["email"]}] if data.get("email") else []
                page = Page.model_validate(
                    {
                        "template": "vcard",
                        "theme": THEME,
                        "blocks": [
                            {"id": "h1", "type": "header", "title": name,
                             "subtitle": data.get("job_title", "")},
                            {"id": "c1", "type": "contact",
                             "first_name": data.get("first_name", ""),
                             "last_name": data.get("last_name", ""),
                             "organization": data.get("organization", ""),
                             "job_title": data.get("job_title", ""),
                             "phones": phones, "emails": emails,
                             "website": data.get("website", ""),
                             "address": {"street": data.get("street", ""),
                                         "city": data.get("city", "")}},
                        ],
                    }
                )  # fmt: skip
                payload = QrCreate(
                    name=name[:120], qr_type="vcard", dynamic=True, page=page, design=design
                )
            ctx = CompanyContext(user=user, workspace=workspace, access="trial", company=company)
            return insert_qr(session, ctx, payload)
    except Exception:  # noqa: BLE001 - signup must never fail because of the handoff
        log.warning("Handoff from the free generator could not be applied", exc_info=True)
        return None
