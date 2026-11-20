import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from . import __version__
from .abuse.router import admin as abuse_admin_router
from .abuse.router import public as abuse_public_router
from .account import router as account_router
from .admin.clients import router as clients_router
from .admin.metrics_router import router as metrics_router
from .admin.router import router as admin_router
from .auth.onboarding import router as onboarding_router
from .auth.router import router as auth_router
from .billing.admin import router as billing_admin_router
from .billing.router import router as billing_router
from .companies.router import account_router as company_account_router
from .companies.router import router as companies_router
from .companies.transfers import router as transfers_router
from .contact import router as contact_router
from .core.config import get_settings
from .core.database import get_engine
from .core.errors import install_handlers
from .generator import router as generator_router
from .generator import site_router
from .imports.router import router as imports_router
from .links.organization import router as organization_router
from .links.organization import search_router
from .links.router import links_qr as links_qr_router
from .links.router import public as links_public_router
from .links.router import router as links_router
from .links.router import utm as utm_router
from .pages.events import router as page_events_router
from .pages.public import router as pages_public_router
from .qr.router import router as qr_router
from .qr.styles_router import router as styles_router
from .redirect.router import router as redirect_router
from .reports.router import public as reports_public_router
from .reports.router import router as reports_router
from .stats.router import router as stats_router
from .storage.public import router as files_public_router
from .storage.router import router as files_router

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
    for router in (
        auth_router,
        onboarding_router,
        account_router,
        company_account_router,
        companies_router,
        transfers_router,
        stats_router,
        files_router,
        files_public_router,
        styles_router,
        imports_router,
        organization_router,
        search_router,
        links_router,
        links_qr_router,
        utm_router,
        links_public_router,
        qr_router,
        pages_public_router,
        page_events_router,
        admin_router,
        clients_router,
        metrics_router,
        abuse_admin_router,
        abuse_public_router,
        billing_router,
        generator_router,
        contact_router,
        reports_router,
        reports_public_router,
        site_router,
        billing_admin_router,
        redirect_router,
    ):
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
