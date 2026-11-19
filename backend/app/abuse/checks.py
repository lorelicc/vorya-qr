"""Destination checks run at QR creation and update: admin blocklist + URL reputation.

The reputation provider is behind a small interface. The default is Google Safe Browsing v4
(Lookup API), used only when SAFE_BROWSING_API_KEY is set; otherwise the check is skipped and
logged. Note: the Safe Browsing Lookup API is meant for non-commercial use; for a commercial
service Google points to the Web Risk API, which can be added as another provider."""

import json
import logging
import urllib.request
from collections.abc import Iterable
from typing import Protocol
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.errors import CodedError
from ..models import BlockedDomain

log = logging.getLogger(__name__)
SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find?key={key}"


class ReputationProvider(Protocol):
    def flagged(self, urls: list[str]) -> set[str]: ...


class NoProvider:
    def flagged(self, urls: list[str]) -> set[str]:
        log.info("Controllo Safe Browsing saltato: SAFE_BROWSING_API_KEY non impostata")
        return set()


class GoogleSafeBrowsing:
    def __init__(self, key: str):
        self.key = key

    def flagged(self, urls: list[str]) -> set[str]:
        body = {
            "client": {"clientId": "vorya-qr", "clientVersion": "0.3.0"},
            "threatInfo": {
                "threatTypes": [
                    "MALWARE",
                    "SOCIAL_ENGINEERING",
                    "UNWANTED_SOFTWARE",
                    "POTENTIALLY_HARMFUL_APPLICATION",
                ],  # fmt: skip
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": u} for u in urls[:500]],
            },
        }
        request = urllib.request.Request(
            SAFE_BROWSING_URL.format(key=self.key),
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=4) as response:  # noqa: S310
                data = json.loads(response.read() or b"{}")
        except Exception as exc:  # noqa: BLE001 - fail open: an outage must not block users
            log.warning(
                "Safe Browsing non raggiungibile (%s): controllo saltato", type(exc).__name__
            )
            return set()
        return {m["threat"]["url"] for m in data.get("matches", []) if "threat" in m}


_provider: ReputationProvider | None = None


def provider() -> ReputationProvider:
    global _provider
    if _provider is None:
        key = get_settings().safe_browsing_api_key.get_secret_value()
        _provider = GoogleSafeBrowsing(key) if key else NoProvider()
    return _provider


def set_provider(value: ReputationProvider | None) -> None:
    """For tests and for plugging another provider (e.g. Web Risk)."""
    global _provider
    _provider = value


def urls_in(value) -> list[str]:
    """Every http(s) URL inside a target URL, static data or page document."""
    found: list[str] = []

    def walk(node):
        if isinstance(node, str):
            if node.startswith(("http://", "https://")):
                found.append(node)
        elif isinstance(node, dict):
            for item in node.values():
                walk(item)
        elif isinstance(node, list | tuple):
            for item in node:
                walk(item)

    walk(value)
    return list(dict.fromkeys(found))


def normalise_domain(value: str) -> str:
    value = value.strip().lower()
    if "://" in value:
        value = urlsplit(value).hostname or ""
    return value.strip(".").removeprefix("www.")


def _host(url: str) -> str:
    try:
        return (urlsplit(url).hostname or "").lower().strip(".")
    except ValueError:
        return ""


def blocked_match(session: Session, urls: Iterable[str]) -> str | None:
    hosts = {_host(u) for u in urls} - {""}
    if not hosts:
        return None
    candidates = set()
    for host in hosts:
        parts = host.split(".")
        candidates |= {".".join(parts[i:]) for i in range(len(parts) - 1)}
    return session.scalar(select(BlockedDomain.domain).where(BlockedDomain.domain.in_(candidates)))


def _refuse(detail: str, code: str) -> CodedError:
    error = CodedError(422, detail, code)
    error.field = "destination"  # type: ignore[attr-defined]
    return error


def check_destinations(session: Session, *values) -> None:
    urls = [u for value in values for u in urls_in(value)]
    if not urls:
        return
    if blocked_match(session, urls):
        raise _refuse("Questa destinazione non è consentita su Vorya QR.", "blocked_domain")
    if provider().flagged(urls):
        raise _refuse(
            "Destinazione segnalata come pericolosa (phishing o malware): non può essere usata.",
            "unsafe_url",
        )


def blocked_domains_of(session: Session) -> list[str]:
    """All blocked domains, loaded once (bulk imports check thousands of URLs in memory)."""
    return list(session.scalars(select(BlockedDomain.domain)))


def host_blocked(domains: list[str], host: str) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def flagged_urls(urls: list[str]) -> set[str]:
    """URLs the reputation provider flags, asked in batches of 500."""
    unique = list(dict.fromkeys(urls))
    found: set[str] = set()
    for start in range(0, len(unique), 500):
        found |= provider().flagged(unique[start : start + 500])
    return found
