from sqlalchemy.orm import Session

from ..models import PlatformSetting

DEFAULTS = {"grace_days": 7, "redirect_days": 30}


def billing_settings(session: Session) -> dict:
    row = session.get(PlatformSetting, "billing")
    return {**DEFAULTS, **(row.data if row else {})}
