"""One-shot migration entry point: `python -m app.migrate` (compose `migrate` service)."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from .core.config import get_settings
from .core.database import make_engine

MIGRATION_LOCK = 71830101


def migrate(url: str | None = None) -> None:
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    engine = make_engine(url or get_settings().database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": MIGRATION_LOCK})
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
    finally:
        engine.dispose()


if __name__ == "__main__":
    migrate()
    print("Migrazioni applicate.")
