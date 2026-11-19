/** Explicit list of backend routes reachable through the /api proxy. Anything else is 404. */
type Rule = { method: "GET" | "POST" | "PUT" | "DELETE"; pattern: RegExp };

const ID = String.raw`\d+`;
const rules: Rule[] = [
  { method: "GET", pattern: /^health$/ },
  ...["login", "logout", "register", "verify-email", "forgot-password", "reset-password"].map(
    (name) => ({ method: "POST" as const, pattern: new RegExp(`^auth/${name}$`) }),
  ),
  { method: "GET", pattern: /^auth\/me$/ },
  { method: "GET", pattern: /^account\/plan$/ },
  { method: "GET", pattern: /^qr-codes$/ },
  { method: "POST", pattern: /^qr-codes$/ },
  { method: "POST", pattern: /^qr-codes\/preview$/ },
  { method: "GET", pattern: new RegExp(`^qr-codes/${ID}$`) },
  { method: "PUT", pattern: new RegExp(`^qr-codes/${ID}$`) },
  { method: "DELETE", pattern: new RegExp(`^qr-codes/${ID}$`) },
  { method: "POST", pattern: new RegExp(`^qr-codes/${ID}/(pause|resume)$`) },
  { method: "GET", pattern: new RegExp(`^qr-codes/${ID}/(stats|image\\.svg|image\\.png)$`) },
  { method: "GET", pattern: /^admin\/(workspaces|plans)$/ },
  { method: "GET", pattern: new RegExp(`^admin/workspaces/${ID}$`) },
  { method: "PUT", pattern: new RegExp(`^admin/workspaces/${ID}/plan$`) },
  { method: "POST", pattern: new RegExp(`^admin/workspaces/${ID}/(suspend|reactivate)$`) },
  { method: "PUT", pattern: /^admin\/plans\/[a-z0-9_-]{1,24}$/ },
];

export function isAllowed(path: string, method: string): boolean {
  return rules.some((rule) => rule.method === method && rule.pattern.test(path));
}

export function backendPath(path: string): string {
  return path === "health" ? "/health" : `/api/${path}`;
}
