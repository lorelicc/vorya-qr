import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from . import __version__
from .account import router as account_router
from .admin.router import router as admin_router
from .auth.onboarding import router as onboarding_router
from .auth.router import router as auth_router
from .core.config import get_settings
from .core.database import get_engine
from .core.errors import install_handlers

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    development = get_settings().app_env == "development"
    app = FastAPI(
        title="Vorya QR",
        version=__version__,
        docs_url="/api/docs" if development else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if development else None,
    )
    install_handlers(app)
    for router in (auth_router, onboarding_router, account_router, admin_router):
        app.include_router(router)

    @app.get("/health", tags=["system"])
    def health():
        try:
            with get_engine().connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            return JSONResponse(
                status_code=503,
                content={"status": "error", "database": "unavailable", "version": __version__},
            )
        return {"status": "ok", "database": "connected", "version": __version__}

    return app


app = create_app()
