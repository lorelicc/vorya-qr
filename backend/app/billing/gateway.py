"""The only module that talks to Stripe. Tests replace these functions with fakes.

Keys come from the environment; a live key is refused unless STRIPE_LIVE_ALLOWED=true.
"""

import stripe
from fastapi import HTTPException

from ..core.config import get_settings


def mode() -> str:
    key = get_settings().stripe_secret_key.get_secret_value()
    return "live" if key.startswith(("sk_live_", "rk_live_")) else "test"


def configured() -> bool:
    key = get_settings().stripe_secret_key.get_secret_value()
    return key.startswith(("sk_test_", "rk_test_", "sk_live_", "rk_live_"))


def client() -> stripe.StripeClient:
    s = get_settings()
    key = s.stripe_secret_key.get_secret_value()
    if not configured():
        raise HTTPException(503, "Pagamenti online non configurati.")
    if mode() == "live" and not s.stripe_live_allowed:
        raise HTTPException(503, "Pagamenti live non abilitati su questo ambiente.")
    return stripe.StripeClient(
        key, max_network_retries=2, http_client=stripe.RequestsClient(timeout=20)
    )


def _dict(obj) -> dict:
    return obj.to_dict() if hasattr(obj, "to_dict") else dict(obj)


def _call(fn, *args, **kwargs) -> dict:
    try:
        return _dict(fn(*args, **kwargs))
    except stripe.StripeError:
        raise HTTPException(
            502, "Stripe non è raggiungibile in questo momento. Riprova tra poco."
        ) from None


def retrieve_price(price_id: str) -> dict:
    return _call(client().prices.retrieve, price_id)


def create_customer(**params) -> dict:
    return _call(client().customers.create, params=params)


def update_customer(customer_id: str, **params) -> dict:
    return _call(client().customers.update, customer_id, params=params)


def create_checkout(**params) -> dict:
    return _call(client().checkout.sessions.create, params=params)


def create_portal(**params) -> dict:
    return _call(client().billing_portal.sessions.create, params=params)


def retrieve_subscription(subscription_id: str) -> dict:
    return _call(client().subscriptions.retrieve, subscription_id)


def update_subscription(subscription_id: str, **params) -> dict:
    return _call(client().subscriptions.update, subscription_id, params=params)


def preview_invoice(**params) -> dict:
    return _call(client().invoices.create_preview, params=params)


def verify_webhook(body: bytes, signature: str) -> dict:
    secret = get_settings().stripe_webhook_secret.get_secret_value()
    if not secret:
        raise HTTPException(503, "Webhook non configurato.")
    try:
        return _dict(stripe.Webhook.construct_event(body, signature, secret))
    except (ValueError, stripe.SignatureVerificationError):
        raise HTTPException(400, "Firma webhook non valida.") from None
