"""Approximate place of a scan from the DB-IP Lite City database (CC BY 4.0, attribution shown
in the statistics page). Only country code and city name are kept; the IP is never stored.
If the database file is missing, statistics simply have no places."""

import ipaddress
import logging
from functools import lru_cache
from typing import Any

import maxminddb

from ..core.config import get_settings

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def reader() -> Any | None:
    path = get_settings().geoip_db_path
    try:
        return maxminddb.open_database(path)
    except (FileNotFoundError, OSError, ValueError, maxminddb.InvalidDatabaseError):
        log.info("Database GeoIP non disponibile (%s): statistiche senza luoghi", path)
        return None


def lookup(ip: str) -> tuple[str | None, str | None]:
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return None, None
    if address.is_private or address.is_loopback or address.is_reserved:
        return None, None
    db = reader()
    if db is None:
        return None, None
    try:
        record = db.get(str(address)) or {}
    except Exception:  # noqa: BLE001 - a broken record must never break a scan
        return None, None
    country = (record.get("country") or {}).get("iso_code")
    names = (record.get("city") or {}).get("names") or {}
    city = names.get("it") or names.get("en")
    return (country[:2].upper() if country else None), (city[:80] if city else None)
