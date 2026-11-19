"""Transactional emails (Italian). Links carry the token in the URL fragment, never in the query."""

import html

from ..core.config import get_settings
from .mailer import send_email


def _layout(title: str, body: str, cta_url: str, cta_label: str) -> str:
    base = html.escape(get_settings().public_base_url)
    url = html.escape(cta_url, quote=True)
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#091411;max-width:520px">'
        f'<img src="{base}/assets/branding/vorya_qr.png" width="180" alt="Vorya QR">'
        f'<h1 style="font-size:22px">{html.escape(title)}</h1>'
        f'<p style="font-size:14px;line-height:1.5">{body}</p>'
        f'<p><a href="{url}" style="display:inline-block;padding:12px 18px;border-radius:8px;'
        f'background:#00e99a;color:#091411;font-weight:bold;text-decoration:none">'
        f"{html.escape(cta_label)}</a></p>"
        '<p style="font-size:12px;color:#567067">Se non hai richiesto tu questa email, '
        "puoi ignorarla.</p></div>"
    )


def send_verification(email: str, name: str, token: str) -> None:
    url = f"{get_settings().public_base_url}/verify-email#{token}"
    send_email(
        email,
        "Conferma il tuo indirizzo · Vorya QR",
        f"Ciao {name},\nconferma il tuo indirizzo per attivare Vorya QR e iniziare i 14 giorni "
        f"di prova: {url}\nIl link scade tra 24 ore.",
        _layout(
            "Conferma il tuo indirizzo",
            f"Ciao {html.escape(name)}, conferma l'indirizzo per attivare Vorya QR e iniziare "
            "i 14 giorni di prova gratuita. Il link scade tra 24 ore.",
            url,
            "Conferma e inizia",
        ),
        kind="verify",
    )


def send_password_reset(email: str, name: str, token: str) -> None:
    url = f"{get_settings().public_base_url}/reset-password#{token}"
    send_email(
        email,
        "Reimposta la password · Vorya QR",
        f"Ciao {name},\nper scegliere una nuova password apri: {url}\nIl link scade tra 30 minuti.",
        _layout(
            "Reimposta la password",
            f"Ciao {html.escape(name)}, per scegliere una nuova password usa il pulsante qui "
            "sotto. Il link scade tra 30 minuti.",
            url,
            "Scegli una nuova password",
        ),
        kind="reset",
    )


def send_transfer_request(email: str, name: str, company: str, sender: str, token: str) -> None:
    url = f"{get_settings().public_base_url}/companies#transfer={token}"
    send_email(
        email,
        f"{sender} vuole trasferirti l'azienda «{company}» · Vorya QR",
        f"Ciao {name},\n{sender} vuole trasferire al tuo account Vorya QR l'azienda «{company}», "
        f"con i suoi codici QR, file e statistiche.\nPer accettare o rifiutare: {url}\n"
        "La richiesta scade tra 7 giorni.",
        _layout(
            "Richiesta di trasferimento",
            f"Ciao {html.escape(name)}, {html.escape(sender)} vuole trasferire al tuo account "
            f"l'azienda «{html.escape(company)}», con i suoi codici QR, file e statistiche. "
            "I QR continueranno a funzionare senza interruzioni. La richiesta scade tra 7 giorni.",
            url,
            "Vedi la richiesta",
        ),
        kind="transfer",
    )


def send_transfer_outcome(email: str, name: str, company: str, outcome: str) -> None:
    text = {
        "accepted_sender": f"l'azienda «{company}» è stata trasferita: non è più nel tuo account.",
        "accepted_recipient": f"l'azienda «{company}» è ora nel tuo account Vorya QR.",
        "declined": f"la richiesta di trasferimento dell'azienda «{company}» è stata rifiutata.",
    }[outcome]
    url = f"{get_settings().public_base_url}/companies"
    send_email(
        email,
        "Trasferimento azienda · Vorya QR",
        f"Ciao {name},\n{text}\n{url}",
        _layout(
            "Trasferimento azienda",
            f"Ciao {html.escape(name)}, {html.escape(text)}",
            url,
            "Apri Vorya QR",
        ),  # fmt: skip
        kind="transfer",
    )
