import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const privateHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "no-store, private" },
];

const origin = (value?: string) => {
  try {
    return value ? new URL(value).origin : "";
  } catch {
    return "";
  }
};

/**
 * Content-Security-Policy for site, app and hosted pages. Third parties are listed only when
 * their environment variable is set (Umami, GlitchTip, the Google Ads tag).
 */
function csp(): string {
  const umami = origin(process.env.NEXT_PUBLIC_UMAMI_URL);
  const sentry = origin(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const ads = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
  const google = ads
    ? ["https://www.googletagmanager.com", "https://www.google-analytics.com"]
    : [];
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${[umami, ...google].join(" ")}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${google.join(" ")}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${[umami, sentry, ...google, ads ? "https://www.google.com" : ""].filter(Boolean).join(" ")}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const baseHeaders = [
  { key: "Content-Security-Policy", value: csp() },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const config: NextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "mdx"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      ...[
        "/login",
        "/register",
        "/verify-email",
        "/forgot-password",
        "/reset-password",
        "/suspended",
        "/access-denied",
        "/app/:path*",
        "/account/:path*",
        "/admin/:path*",
        "/api/:path*",
      ].map((source) => ({ source, headers: privateHeaders })),
    ];
  },
};

// Guides are MDX files under /content (imported by the guide pages, never routed directly).
export default createMDX()(config);
