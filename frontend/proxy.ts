import { NextRequest, NextResponse } from "next/server";
import { isRootShortLink } from "./lib/reserved";

const apiBase = () => process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
const RELAY = ["location", "cache-control", "content-type", "x-robots-tag"];
const PRIVATE = /^\/(app|account|admin|companies)(\/|$)/;

/**
 * /r/{slug}: the backend decides (and counts the scan). Redirects are relayed untouched (302,
 * no-store); hosted pages are rendered on the same URL by rewriting to /p/{slug}.
 */
async function shortLink(request: NextRequest, slug: string) {
  try {
    const response = await fetch(`${apiBase()}/r/${encodeURIComponent(slug)}`, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers: {
        "User-Agent": request.headers.get("user-agent") ?? "",
        Referer: request.headers.get("referer") ?? "",
        "X-Vorya-Client-IP":
          request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.headers.get("x-vorya-destination") === "page") {
      // Aliases resolve to the canonical slug: the page is always rendered from it.
      const canonical = response.headers.get("x-vorya-slug") ?? slug;
      const rewritten = NextResponse.rewrite(
        new URL(`/p/${encodeURIComponent(canonical)}`, request.url),
      );
      rewritten.headers.set("Cache-Control", "no-store");
      return rewritten;
    }
    const headers = new Headers();
    for (const name of RELAY) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    const body = request.method === "HEAD" ? null : await response.arrayBuffer();
    return new NextResponse(body, { status: response.status, headers });
  } catch {
    return new NextResponse("Servizio temporaneamente non disponibile.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/**
 * Private areas: without a session cookie go straight to /login. Real authorization happens
 * server-side (lib/auth-server.ts) and in the backend.
 */
export function proxy(request: NextRequest) {
  const short = request.nextUrl.pathname.match(/^\/r\/([^/]+)$/);
  if (short) return shortLink(request, short[1]);
  // 0.3: https://qr.vorya.it/{slug-or-alias}, same decision as /r/{slug}.
  const root = request.nextUrl.pathname.match(/^\/([^/]+)$/);
  if (root && isRootShortLink(root[1])) return shortLink(request, root[1]);
  // The /:slug matcher also sees public pages (/login, /report…): only private areas are gated.
  if (!PRIVATE.test(request.nextUrl.pathname)) return NextResponse.next();
  if (!request.cookies.has("vorya_qr_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/r/:slug",
    "/:slug",
    "/app/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/companies/:path*",
  ],
};
