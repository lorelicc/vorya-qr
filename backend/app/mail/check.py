"""SMTP sanity check: logged at startup, reported by /health/detail. Never logs secrets."""

import logging
import smtplib
import ssl
import threading

from ..core.config import get_settings

log = logging.getLogger("vorya_qr.mail")


def config_problems() -> list[str]:
    s = get_settings()
    if s.mail_transport != "smtp":
        return []
    problems = []
    if not s.smtp_host:
        problems.append("SMTP_HOST mancante")
    if not s.smtp_user:
        problems.append("SMTP_USER mancante")
    if not s.smtp_password.get_secret_value():
        problems.append("SMTP_PASSWORD mancante")
    from_domain = s.smtp_from_email.rsplit("@", 1)[-1].lower()
    user_domain = s.smtp_user.rsplit("@", 1)[-1].lower() if "@" in s.smtp_user else ""
    if user_domain and from_domain != user_domain:
        problems.append(
            f"il mittente ({from_domain}) è diverso dal dominio dell'account SMTP ({user_domain}): "
            "controlla SPF, DKIM e DMARC"
        )
    return problems


def smtp_status(timeout: int = 4) -> dict:
    s = get_settings()
    if s.mail_transport != "smtp":
        return {"transport": s.mail_transport, "ok": True, "problems": []}
    problems = config_problems()
    ok = not [p for p in problems if "mancante" in p]
    if ok:
        try:
            context = ssl.create_default_context()
            if s.smtp_security == "ssl":
                client = smtplib.SMTP_SSL(
                    s.smtp_host, s.smtp_port, timeout=timeout, context=context
                )
            else:
                client = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=timeout)
                client.starttls(context=context)
            with client:
                client.login(s.smtp_user, s.smtp_password.get_secret_value())
        except Exception as exc:  # noqa: BLE001
            ok = False
            problems.append(f"connessione o accesso SMTP non riusciti ({type(exc).__name__})")
    return {"transport": "smtp", "ok": ok, "problems": problems}


def startup_check() -> None:
    """Warn in the logs if the mail setup looks wrong (done in the background: never blocks)."""

    def run() -> None:
        status = smtp_status()
        for problem in status["problems"]:
            log.warning("SMTP: %s", problem)
        if status["transport"] == "smtp" and status["ok"] and not status["problems"]:
            log.info("SMTP configurato e raggiungibile")

    if get_settings().mail_transport == "smtp":
        threading.Thread(target=run, daemon=True).start()
