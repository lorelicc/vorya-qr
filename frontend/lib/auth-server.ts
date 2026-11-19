import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Me } from "./types";

export const SESSION_COOKIE = "vorya_qr_session";
export const apiBase = () => process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

async function fetchMe(): Promise<Me | null> {
  const jar = await cookies();
  if (!jar.has(SESSION_COOKIE)) return null;
  const response = await fetch(`${apiBase()}/api/auth/me`, {
    headers: { Cookie: jar.toString() },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Impossibile verificare la sessione.");
  return (await response.json()) as Me;
}

export async function optionalUser(): Promise<Me | null> {
  try {
    return await fetchMe();
  } catch {
    return null;
  }
}

/** Customer pages. Blocked workspaces (trial expired, suspended) go to /suspended. */
export async function requireCustomer(): Promise<Me> {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.role !== "company_admin") redirect("/admin");
  const access = me.workspace?.access;
  if (access === "trial_expired" || access === "suspended" || access === "payment_blocked")
    redirect("/suspended");
  return me;
}

export async function requireAdmin(): Promise<Me> {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.role === "company_admin") redirect("/access-denied");
  return me;
}

export async function requireUser(): Promise<Me> {
  const me = await fetchMe();
  if (!me) redirect("/login");
  return me;
}

/** Server-side GET to the backend with the browser's cookies. Returns null on 404. */
export async function serverGet<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const response = await fetch(`${apiBase()}/api/${path}`, {
    headers: { Cookie: jar.toString() },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return null;
  if (response.status === 401) redirect("/login");
  if (response.status === 423) redirect("/suspended");
  if (!response.ok) throw new Error("Impossibile caricare i dati.");
  return (await response.json()) as T;
}

/** Billing pages: any customer, also when the workspace is blocked (they must be able to pay). */
export async function requireBillingCustomer(): Promise<Me> {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.role !== "company_admin") redirect("/admin");
  if (me.workspace?.access === "suspended") redirect("/suspended");
  return me;
}
