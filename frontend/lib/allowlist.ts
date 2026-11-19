/** Explicit list of backend routes reachable through the /api proxy. Anything else is 404. */
type Rule = { method: "GET" | "POST" | "PUT" | "DELETE"; pattern: RegExp };

const ID = String.raw`\d+`;
const C = String.raw`companies/\d+`;
const QR = String.raw`companies/\d+/qr-codes`;
const r = (method: Rule["method"], source: string): Rule => ({
  method,
  pattern: new RegExp(`^${source}$`),
});

const rules: Rule[] = [
  r("GET", "health"),
  ...["login", "logout", "register", "verify-email", "forgot-password", "reset-password"].map(
    (name) => r("POST", `auth/${name}`),
  ),
  r("GET", "auth/me"),
  r("GET", "account/plan"),
  r("PUT", "account/last-company"),
  // Companies
  r("GET", "companies"),
  r("POST", "companies"),
  r("GET", C),
  r("PUT", C),
  r("DELETE", C),
  r("POST", `${C}/(restore|transfer)`),
  r("GET", `${C}/files`),
  r("POST", `${C}/(files|logo)`),
  r("DELETE", `${C}/logo`),
  r("DELETE", `${C}/files/[0-9a-f-]{36}`),
  // QR codes of a company
  r("GET", QR),
  r("POST", QR),
  r("POST", `${QR}/preview`),
  r("GET", `${QR}/${ID}`),
  r("PUT", `${QR}/${ID}`),
  r("DELETE", `${QR}/${ID}`),
  r("POST", `${QR}/${ID}/(pause|resume)`),
  r("GET", `${QR}/${ID}/(stats|stats\\.csv|image\\.svg|image\\.png|image\\.pdf)`),
  r("GET", `${C}/(stats|stats\\.csv)`),
  r("POST", `${QR}/${ID}/apply-style`),
  r("GET", `${C}/styles`),
  r("POST", `${C}/styles`),
  r("PUT", `${C}/styles/${ID}`),
  r("DELETE", `${C}/styles/${ID}`),
  r("GET", `${QR}/${ID}/page`),
  r("POST", `${QR}/${ID}/duplicate`),
  // Public hosted pages
  r("GET", "public/pages/[A-Za-z0-9]{7}/vcard/[A-Za-z0-9_-]{1,24}\\.vcf"),
  r("POST", "public/pages/[A-Za-z0-9]{7}/events"),
  // Transfers
  r("GET", "company-transfers"),
  r("POST", "company-transfers/by-token"),
  r("POST", `company-transfers/${ID}/(accept|decline|cancel)`),
  // Admin
  r("GET", "admin/(workspaces|plans|company-transfers)"),
  r("GET", `admin/workspaces/${ID}`),
  r("PUT", `admin/workspaces/${ID}/plan`),
  r("POST", `admin/workspaces/${ID}/(suspend|reactivate)`),
  r("PUT", "admin/plans/[a-z0-9_-]{1,24}"),
];

export function isAllowed(path: string, method: string): boolean {
  return rules.some((rule) => rule.method === method && rule.pattern.test(path));
}

export function backendPath(path: string): string {
  return path === "health" ? "/health" : `/api/${path}`;
}
