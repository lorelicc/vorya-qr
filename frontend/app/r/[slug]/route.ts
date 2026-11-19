import { NextRequest } from "next/server";

/**
 * Short links live on the same public origin (SHORT_LINK_BASE_URL). The backend decides
 * everything (302 to the destination, or the "QR non attivo" page); this handler only relays
 * the response as-is, without following the redirect.
 */
const apiBase = () => process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
const RELAY = ["location", "cache-control", "content-type", "x-robots-tag"];

async function relay(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const response = await fetch(`${apiBase()}/r/${encodeURIComponent(slug)}`, {
      method: request.method,
      headers: {
        "User-Agent": request.headers.get("user-agent") ?? "",
        Referer: request.headers.get("referer") ?? "",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const headers = new Headers();
    for (const name of RELAY) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    const body = request.method === "HEAD" ? null : await response.arrayBuffer();
    return new Response(body, { status: response.status, headers });
  } catch {
    return new Response("Servizio temporaneamente non disponibile.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const GET = relay;
export const HEAD = relay;
export const dynamic = "force-dynamic";
