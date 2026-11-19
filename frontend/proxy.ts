import { NextRequest, NextResponse } from "next/server";

/**
 * Cheap gate for private areas: without a session cookie go straight to /login.
 * Real authorization happens server-side (lib/auth-server.ts) and in the backend.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("vorya_qr_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/account/:path*", "/admin/:path*"] };
