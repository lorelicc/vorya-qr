from alembic import context

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.config import get_settings
from app.core.database import Base, make_engine

target_metadata = Base.metadata


def run() -> None:
    connection = context.config.attributes.get("connection")
    if connection is not None:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = make_engine(get_settings().database_url)
    with engine.begin() as conn:
        context.configure(connection=conn, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run()
