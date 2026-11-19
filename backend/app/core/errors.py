import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

logger = logging.getLogger(__name__)


class QuotaExceeded(Exception):
    def __init__(self, detail: str, code: str):
        super().__init__(detail)
        self.detail = detail
        self.code = code


class CodedError(Exception):
    """An error with a machine-readable code: {"detail": message, "code": code}."""

    def __init__(self, status: int, detail: str, code: str):
        super().__init__(detail)
        self.status, self.detail, self.code = status, detail, code


class AccessBlocked(Exception):
    """Raised when the workspace cannot use the app (trial expired or suspended)."""

    def __init__(self, state: str):
        super().__init__(state)
        self.state = state


ACCESS_MESSAGES = {
    "trial_expired": "Il periodo di prova è terminato, contattaci per attivare un piano.",
    "suspended": "Account sospeso. Contattaci per maggiori informazioni.",
}


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(QuotaExceeded)
    def quota(_: Request, exc: QuotaExceeded):
        return JSONResponse(status_code=409, content={"detail": exc.detail, "code": exc.code})

    @app.exception_handler(CodedError)
    def coded(_: Request, exc: CodedError):
        return JSONResponse(
            status_code=exc.status, content={"detail": exc.detail, "code": exc.code}
        )

    @app.exception_handler(AccessBlocked)
    def blocked(_: Request, exc: AccessBlocked):
        return JSONResponse(
            status_code=423,
            content={"detail": ACCESS_MESSAGES[exc.state], "code": exc.state},
        )

    @app.exception_handler(IntegrityError)
    def integrity(_: Request, exc: IntegrityError):
        return JSONResponse(
            status_code=409,
            content={"detail": "Operazione in conflitto con dati esistenti. Riprova."},
        )

    @app.exception_handler(SQLAlchemyError)
    def database(_: Request, exc: SQLAlchemyError):
        logger.error("Database operation failed: %s", type(exc).__name__)
        return JSONResponse(
            status_code=503,
            content={"detail": "Servizio temporaneamente non disponibile. Riprova tra poco."},
        )

    @app.exception_handler(RequestValidationError)
    def validation(_: Request, exc: RequestValidationError):
        errors = [
            {
                "field": str(error["loc"][-1]) if error.get("loc") else "",
                "message": str(error.get("msg", "Valore non valido")).removeprefix("Value error, "),
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"detail": "Controlla i campi evidenziati.", "errors": errors},
        )
