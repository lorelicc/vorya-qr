import { NextRequest } from "next/server";

/** Public files (/f/{id}/{variant}): relays the backend response, Range included (iPhone audio). */
const apiBase = () => process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
const RELAY = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-security-policy",
  "x-content-type-options",
  "cross-origin-resource-policy",
];

async function relay(
  request: NextRequest,
  context: { params: Promise<{ id: string; variant: string }> },
) {
  const { id, variant } = await context.params;
  const range = request.headers.get("range");
  try {
    const response = await fetch(
      `${apiBase()}/f/${encodeURIComponent(id)}/${encodeURIComponent(variant)}${request.nextUrl.search}`,
      {
        method: request.method,
        headers: range ? { Range: range } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
      },
    );
    const headers = new Headers();
    for (const name of RELAY) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers,
    });
  } catch {
    return new Response("File non disponibile.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = relay;
export const HEAD = relay;
export const dynamic = "force-dynamic";
