"""Words that can never be a short link back-half.

`ROUTE_WORDS` covers every first-level path of the app (a test checks `frontend/app` against it)
plus technical paths. `BLOCKED_WORDS` are misleading or phishing-prone words; admins can add
more (`reserved_words` table, kind "blocked")."""

ROUTE_WORDS = frozenset({
    "_next", "access-denied", "account", "admin", "api", "app", "assets", "companies", "f",
    "favicon.ico", "forgot-password", "health", "legal", "login", "logout", "p", "plans", "r",
    "register", "report", "reset-password", "robots.txt", "sitemap.xml", "static", "suspended",
    "verify-email", "billing", "checkout", "signup", "settings", "help", "docs", "status",
    "www", "mail", "unlock", "expired",
})  # fmt: skip

BLOCKED_WORDS = frozenset({
    "paypal", "bank", "banca", "banking", "verifica", "verify", "password", "secure", "sicurezza",
    "poste", "postepay", "amazon", "apple", "icloud", "google", "microsoft", "outlook", "office365",
    "facebook", "instagram", "whatsapp", "netflix", "inps", "agenzia-entrate", "spid", "cie",
    "assistenza", "supporto", "support", "rimborso", "refund", "wallet", "crypto", "bitcoin",
    "vorya", "admin-login", "signin", "sign-in", "accedi", "conto", "carta", "pagamento",
})  # fmt: skip
