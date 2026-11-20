"""Structured JSON logs with a request id, security headers and scrubbed error reporting.

Error reports go to a Sentry-compatible server (GlitchTip, self-hosted) and are scrubbed: no
request bodies, cookies, headers, query strings, user data or e-mail addresses ever leave.
"""

import json
import logging
import re
import uuid
from contextvars import ContextVar

from .config import get_settings

request_id: ContextVar[str] = ContextVar("request_id", default="-")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
RID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(self)",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": EMAIL.sub("<email>", record.getMessage()),
            "request_id": request_id.get(),
        }
        if record.exc_info:
            payload["exc"] = EMAIL.sub("<email>", self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    root = logging.getLogger()
    handler = logging.StreamHandler()
    if get_settings().log_format == "json":
        handler.setFormatter(JsonFormatter())
    root.handlers[:] = [handler]
    root.setLevel(logging.INFO)


def scrub(event: dict, hint: dict) -> dict | None:
    """before_send for Sentry/GlitchTip: keep the stack, drop everything personal."""
    event.pop("user", None)
    event.pop("extra", None)
    event.pop("breadcrumbs", None)
    request = event.get("request") or {}
    for key in ("data", "cookies", "headers", "query_string", "env"):
        request.pop(key, None)
    if "url" in request:
        request["url"] = request["url"].split("?")[0]
    for exc in (event.get("exception") or {}).get("values", []):
        if exc.get("value"):
            exc["value"] = EMAIL.sub("<email>", exc["value"])
        for frame in (exc.get("stacktrace") or {}).get("frames", []):
            frame.pop("vars", None)
    if event.get("message"):
        event["message"] = EMAIL.sub("<email>", event["message"])
    return event


def init_errors() -> bool:
    dsn = get_settings().sentry_dsn
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        send_default_pii=False,
        max_request_body_size="never",
        include_local_variables=False,
        traces_sample_rate=0,
        environment=get_settings().app_env,
        before_send=scrub,
    )
    return True


class ObservabilityMiddleware:
    """Pure ASGI (cheap): request id in/out, security headers on every API response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        incoming = dict(scope.get("headers") or []).get(b"x-request-id", b"").decode("latin-1")
        rid = incoming if RID.match(incoming) else uuid.uuid4().hex[:16]
        token = request_id.set(rid)

        async def wrapped(message):
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                present = {k.lower() for k, _ in headers}
                headers.append((b"x-request-id", rid.encode()))
                for name, value in SECURITY_HEADERS.items():
                    if name.encode() not in present:
                        headers.append((name.encode(), value.encode()))
                if get_settings().is_production and b"strict-transport-security" not in present:
                    headers.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains")
                    )
            await send(message)

        try:
            await self.app(scope, receive, wrapped)
        finally:
            request_id.reset(token)
