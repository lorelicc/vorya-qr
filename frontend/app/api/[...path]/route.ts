import { NextRequest, NextResponse } from "next/server";
import { backendPath, isAllowed } from "@/lib/allowlist";

const MAX_BODY = 64 * 1024;
const PASS_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "x-image-size",
  "retry-after",
];
const apiBase = () => process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

function browserOrigin(request: NextRequest): string {
  // Behind CloudPanel the Host and X-Forwarded-Proto headers describe the public origin.
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol =
    proto === "https" || proto === "http" ? proto : request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return new URL(`${protocol}://${host}`).origin;
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = path.join("/");
  if (!isAllowed(key, request.method)) {
    return NextResponse.json({ detail: "Risorsa non trovata." }, { status: 404 });
  }
  let body: string | undefined;
  if (request.method === "POST" || request.method === "PUT") {
    body = await request.text();
    if (body.length > MAX_BODY) {
      return NextResponse.json(
        { detail: "La richiesta supera il limite consentito." },
        { status: 413 },
      );
    }
  }
  try {
    const response = await fetch(`${apiBase()}${backendPath(key)}${request.nextUrl.search}`, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
        Origin: request.headers.get("origin") ?? "",
        "X-CSRF-Token": request.headers.get("x-csrf-token") ?? "",
        "X-Vorya-Public-Origin": browserOrigin(request),
        "X-Vorya-Client-IP":
          request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "unknown",
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    const headers = new Headers({ "Cache-Control": "no-store, private" });
    for (const name of PASS_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    const payload = response.status === 204 ? null : await response.arrayBuffer();
    return new NextResponse(payload, { status: response.status, headers });
  } catch {
    return NextResponse.json(
      { detail: "Servizio temporaneamente non disponibile. Riprova tra poco." },
      { status: 503 },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
export const dynamic = "force-dynamic";
