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


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-super-admin", help="Crea un amministratore della piattaforma")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)
    create.add_argument("--role", choices=("super_admin", "platform_admin"), default="super_admin")
    args = parser.parse_args(argv)
    try:
        email = create_admin(args.email, args.name, args.role, read_password())
    except ValueError as exc:
        raise SystemExit(str(exc)) from None
    print(f"Creato {args.role}: {email}", file=sys.stdout)


if __name__ == "__main__":
    main()
