"""User-agent classification for scan analytics. Only coarse categories are stored."""

import re
from dataclasses import dataclass

import ua_parser

BOT_PATTERN = re.compile(
    r"bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|"
    r"skype|curl|wget|python|httpclient|okhttp|go-http|java/|headless|lighthouse|monitor",
    re.IGNORECASE,
)
DESKTOP_OS = ("Windows", "Mac OS X", "Linux", "Ubuntu", "Chrome OS", "Fedora", "FreeBSD")


@dataclass(frozen=True)
class ClientInfo:
    device_type: str
    os: str
    browser: str
    is_bot: bool


def _clip(value: str | None) -> str:
    return (value or "Altro")[:40]


def classify(user_agent: str) -> ClientInfo:
    user_agent = (user_agent or "")[:512]
    if not user_agent.strip():
        return ClientInfo("other", "Altro", "Altro", True)
    parsed = ua_parser.parse(user_agent)
    os_name = parsed.os.family if parsed.os else "Altro"
    browser = parsed.user_agent.family if parsed.user_agent else "Altro"
    device = parsed.device.family if parsed.device else ""
    is_bot = bool(BOT_PATTERN.search(user_agent)) or device == "Spider"
    if (
        device == "iPad"
        or "Tablet" in user_agent
        or (os_name == "Android" and "Mobile" not in user_agent)
    ):
        device_type = "tablet"
    elif os_name in ("iOS", "Android") or "Mobile" in user_agent:
        device_type = "mobile"
    elif os_name in DESKTOP_OS:
        device_type = "desktop"
    else:
        device_type = "other"
    if os_name == "Other":
        os_name = "Altro"
    if browser == "Other":
        browser = "Altro"
    return ClientInfo(device_type, _clip(os_name), _clip(browser), is_bot)
