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
  r("POST", `${QR}/${ID}/(pause|resume|generate-qr)`),
  r("POST", `${C}/links`),
  r("GET", `${C}/(folders|tags)`),
  r("POST", `${C}/(folders|tags)`),
  r("PUT", `${C}/(folders|tags)/${ID}`),
  r("DELETE", `${C}/(folders|tags)/${ID}`),
  r("PUT", `${QR}/${ID}/(tags|folder)`),
  r("POST", `${QR}/(bulk|bulk-zip)`),
  r("GET", "search"),
  r("GET", `${C}/imports/template\\.csv`),
  r("POST", `${C}/imports`),
  r("GET", `${C}/imports/${ID}`),
  r("POST", `${C}/imports/${ID}/(confirm|retry)`),
  r("GET", `${C}/imports/${ID}/result\\.zip`),
  r("GET", `${QR}/export\\.csv`),
  r("GET", `${QR}/aliases/check`),
  r("GET", `${QR}/${ID}/(aliases|rules|versions)`),
  r("GET", `${QR}/${ID}/versions/${ID}`),
  r("POST", `${QR}/${ID}/versions/${ID}/restore`),
  r("POST", `${QR}/${ID}/aliases`),
  r("DELETE", `${QR}/${ID}/aliases/${ID}`),
  r("PUT", `${QR}/${ID}/rules`),
  r("GET", `${C}/utm-templates`),
  r("POST", `${C}/utm-templates`),
  r("DELETE", `${C}/utm-templates/${ID}`),
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
  r("POST", "public/reports"),
  r("POST", "public/links/[A-Za-z0-9-]{3,50}/unlock"),
  // Transfers
  r("GET", "company-transfers"),
  r("POST", "company-transfers/by-token"),
  r("POST", `company-transfers/${ID}/(accept|decline|cancel)`),
  // Admin
  r("GET", "admin/(workspaces|plans|company-transfers|reports|blocked-domains|reserved-words)"),
  r("POST", "admin/reserved-words"),
  r("DELETE", "admin/reserved-words/[a-z0-9-]{2,50}"),
  r("POST", `admin/reports/${ID}/resolve`),
  r("POST", `admin/qr-codes/${ID}/unblock`),
  r("POST", "admin/blocked-domains"),
  r("DELETE", `admin/blocked-domains/${ID}`),
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
