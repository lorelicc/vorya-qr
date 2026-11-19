"""Billing emails (Italian) and the outbox worker that sends them once each."""

import html
import logging
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import now
from ..mail.mailer import send_email
from ..mail.templates import _layout
from ..models import BillingMail, Plan, PlanGrant, User, Workspace
from .settings import billing_settings

log = logging.getLogger("vorya_qr.billing")
MAX_ATTEMPTS = 5

SUBJECTS = {
    "trial_3d": "La tua prova termina tra 3 giorni · Vorya QR",
    "trial_0d": "La tua prova termina oggi · Vorya QR",
    "payment_ok": "Pagamento ricevuto · Vorya QR",
    "payment_failed": "Pagamento non riuscito · Vorya QR",
    "canceled": "Abbonamento annullato · Vorya QR",
    "gift": "Hai ricevuto un piano in omaggio · Vorya QR",
}


def body_of(
    kind: str, name: str, grace_days: int, redirect_days: int, extra: str = ""
) -> tuple[str, str, str]:
    """(title, text, cta label). Plain facts: no promises the product does not keep."""
    return {
        "trial_3d": (
            "La prova termina tra 3 giorni",
            f"Ciao {name}, la tua prova gratuita di Vorya QR termina tra 3 giorni. Scegli un "
            "piano per continuare a modificare i tuoi QR e link senza interruzioni.",
            "Scegli un piano",
        ),
        "trial_0d": (
            "La prova termina oggi",
            f"Ciao {name}, oggi termina la tua prova gratuita. I QR già pubblicati continuano a "
            f"funzionare per altri {redirect_days} giorni; per modificarli scegli un piano.",
            "Scegli un piano",
        ),
        "payment_ok": (
            "Pagamento ricevuto",
            f"Ciao {name}, abbiamo ricevuto il tuo pagamento: grazie! Trovi la ricevuta e "
            "lo storico nella pagina del tuo piano.",
            "Vedi il tuo piano",
        ),
        "payment_failed": (
            "Pagamento non riuscito",
            f"Ciao {name}, non siamo riusciti ad addebitare il rinnovo. Aggiorna il metodo di "
            f"pagamento entro {grace_days} giorni: nel frattempo il servizio resta attivo.",
            "Aggiorna il pagamento",
        ),
        "gift": (
            "Un piano in omaggio per te",
            f"Ciao {name}, il team di Vorya QR ti ha regalato {extra}. Tutte le funzioni del "
            "piano sono già attive: buon lavoro!",
            "Apri il tuo piano",
        ),
        "canceled": (
            "Abbonamento annullato",
            f"Ciao {name}, il tuo abbonamento è stato annullato. I QR pubblicati restano attivi "
            f"per {redirect_days} giorni; puoi riattivare il piano in qualsiasi momento, "
            "tutto torna subito disponibile.",
            "Riattiva il piano",
        ),
    }[kind]


def send_pending(session: Session, limit: int = 20) -> int:
    rows = list(
        session.scalars(
            select(BillingMail)
            .where(BillingMail.state == "pending", BillingMail.due_at <= now())
            .order_by(BillingMail.id)
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
    )
    cfg, sent = billing_settings(session), 0
    for row in rows:
        workspace = session.get(Workspace, row.workspace_id)
        owner = session.get(User, workspace.owner_user_id) if workspace else None
        row.attempts += 1
        if owner is None or not owner.is_active:
            row.state = "failed"
            continue
        extra = ""
        if row.kind == "gift":
            grant = session.get(PlanGrant, int(row.event_key.split(":")[1]))  # "gift:<id>"
            plan = session.get(Plan, grant.plan_id) if grant else None
            if grant and plan:
                extra = f"{grant.months} {'mese' if grant.months == 1 else 'mesi'} del piano {plan.name}"
        title, text, cta = body_of(
            row.kind, owner.display_name, int(cfg["grace_days"]), int(cfg["redirect_days"]), extra
        )
        url = f"{get_settings().public_base_url}/app/account/plan"
        try:
            send_email(
                owner.email,
                SUBJECTS[row.kind],
                f"{text}\n{url}",
                _layout(title, html.escape(text), url, cta),
                kind="billing",
            )
            row.state, row.sent_at = "sent", now()
            sent += 1
        except Exception as exc:  # noqa: BLE001
            log.warning("Billing mail failed (%s)", type(exc).__name__)
            row.state = "failed" if row.attempts >= MAX_ATTEMPTS else "pending"
            row.due_at = now() + timedelta(minutes=5 * row.attempts)
    return sent
