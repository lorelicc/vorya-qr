from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import text

from app.core.database import Base, get_engine
from tests.conftest import TEST_URL

ROOT = Path(__file__).resolve().parent.parent


def config():
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    return cfg


def test_models_match_migrations():
    with get_engine().connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []


def test_downgrade_and_upgrade_roundtrip(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", TEST_URL)
    command.downgrade(config(), "base")
    command.upgrade(config(), "head")
    with get_engine().connect() as connection:
        plans = connection.execute(text("SELECT id FROM plans ORDER BY position")).scalars().all()
        trial = connection.execute(
            text("SELECT data FROM platform_settings WHERE key='general'")
        ).scalar_one()
    assert plans == ["start", "pro", "plus"]
    assert trial == {"trial_days": 14, "trial_plan_id": "pro"}
