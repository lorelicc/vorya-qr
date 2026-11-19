/**
 * First-level paths that are never short links (same list as backend app/links/reserved.py
 * ROUTE_WORDS; tests on both sides check every folder in app/ is listed).
 */
export const ROUTE_WORDS = new Set([
  "_next", "access-denied", "account", "admin", "api", "app", "assets", "companies", "f",
  "favicon.ico", "forgot-password", "health", "legal", "login", "logout", "p", "plans", "r",
  "register", "report", "reset-password", "robots.txt", "sitemap.xml", "static", "suspended",
  "verify-email", "billing", "checkout", "signup", "settings", "help", "docs", "status",
  "www", "mail", "unlock", "expired",
]); // prettier-ignore

/** Slugs (7 chars) and custom back-halves (3-50, [a-z0-9-]) resolved at the root. */
export const BACK_HALF = /^[A-Za-z0-9][A-Za-z0-9-]{1,48}[A-Za-z0-9]$/;

export function isRootShortLink(segment: string): boolean {
  return BACK_HALF.test(segment) && !ROUTE_WORDS.has(segment.toLowerCase());
}
