"""Seeds the billing price links for the e2e run (what the admin does in /admin/billing)."""

from sqlalchemy import select

from app.core.database import session_factory
from app.models import BillingPrice

PRICES = [("start", 900), ("pro", 2900), ("plus", 7900)]

with session_factory()() as session:
    for plan, amount in PRICES:
        pid = f"price_e2e_{plan}_m"
        if session.scalar(select(BillingPrice.id).where(BillingPrice.stripe_price_id == pid)):
            continue
        for old in session.scalars(
            select(BillingPrice).where(BillingPrice.plan_id == plan, BillingPrice.cycle == "monthly")
        ):
            old.active = False
        session.flush()
        session.add(BillingPrice(plan_id=plan, cycle="monthly", stripe_price_id=pid, amount_cents=amount))
    session.commit()
