"""Creates .env from .env.example with a random local POSTGRES_PASSWORD. Never overwrites."""

import re
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
target = root / ".env"
if target.exists():
    raise SystemExit(".env esiste già: nessuna modifica.")
password = secrets.token_urlsafe(24).replace("-", "_")
text = (root / ".env.example").read_text(encoding="utf-8")
text = re.sub(r"^POSTGRES_PASSWORD=.*$", f"POSTGRES_PASSWORD={password}", text, flags=re.M)
text = text.replace(":PASSWORD@", f":{password}@")
target.write_text(text, encoding="utf-8")
target.chmod(0o600)
print("Creato .env con una password locale casuale.")
