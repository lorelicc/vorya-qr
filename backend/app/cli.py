"""Administrative CLI.

    python -m app.cli create-super-admin --email admin@example.com --name "Nome Cognome"
    python -m app.cli create-super-admin --email ops@example.com --name Ops --role platform_admin

The password is read from VORYA_QR_ADMIN_PASSWORD if set, otherwise asked twice on the terminal.
"""

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from .core.database import session_factory
from .core.security import hash_password, normalized_email, now
from .models import User


def create_admin(email: str, name: str, role: str, password: str) -> str:
    with session_factory()() as session:
        email = normalized_email(email)
        if session.scalar(select(User).where(User.email == email)):
            raise SystemExit(f"Esiste già un utente con email {email}.")
        session.add(
            User(
                email=email,
                display_name=name.strip(),
                role=role,
                password_hash=hash_password(password),
                is_active=True,
                email_verified_at=now(),
            )
        )
        session.commit()
    return email


def read_password() -> str:
    value = os.environ.get("VORYA_QR_ADMIN_PASSWORD")
    if value:
        return value
    first = getpass.getpass("Password (12-128 caratteri): ")
    if first != getpass.getpass("Ripeti la password: "):
        raise SystemExit("Le password non coincidono.")
    return first


def download_geoip() -> str:
    """Monthly DB-IP Lite City (CC BY 4.0) into GEOIP_DB_PATH, swapped atomically."""
    import gzip
    import os
    import shutil
    import tempfile
    import urllib.request
    from datetime import UTC, datetime
    from pathlib import Path

    from .core.config import get_settings

    target = Path(get_settings().geoip_db_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    month = datetime.now(UTC).strftime("%Y-%m")
    url = f"https://download.db-ip.com/free/dbip-city-lite-{month}.mmdb.gz"
    with (
        tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as tmp,
        urllib.request.urlopen(url, timeout=120) as response,  # noqa: S310 - fixed https URL
        gzip.GzipFile(fileobj=response) as data,
    ):
        shutil.copyfileobj(data, tmp)
    import maxminddb

    maxminddb.open_database(tmp.name).close()  # refuse a broken download
    os.replace(tmp.name, target)
    return f"Database GeoIP aggiornato: {target} (riavvia backend per ricaricarlo)"


def check_reserved() -> str:
    from .links.collisions import find_collisions

    with session_factory()() as session:
        found = find_collisions(session)
    if not found:
        return "Nessuna collisione: nessuno slug o alias coincide con una parola riservata."
    lines = [f"- {c['kind']} #{c['id']}: «{c['value']}»" for c in found]
    return (
        f"{len(found)} collisioni (il link dell'utente vince sul percorso del sito):\n"
        + "\n".join(lines)
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-super-admin", help="Crea un amministratore della piattaforma")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--role", choices=("super_admin", "platform_admin"), default="super_admin")
    sub.add_parser("download-geoip", help="Scarica il database DB-IP Lite City del mese")
    sub.add_parser(
        "check-reserved", help="Elenca slug e alias in conflitto con le parole riservate del sito"
    )
    args = parser.parse_args(argv)
    if args.command == "check-reserved":
        print(check_reserved(), file=sys.stdout)
        return
    if args.command == "download-geoip":
        print(download_geoip(), file=sys.stdout)
        return
    try:
        email = create_admin(args.email, args.name, args.role, read_password())
    except ValueError as exc:
        raise SystemExit(str(exc)) from None
    print(f"Creato {args.role}: {email}", file=sys.stdout)


if __name__ == "__main__":
    main()
