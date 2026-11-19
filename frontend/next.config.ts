import type { NextConfig } from "next";

const privateHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "no-store, private" },
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
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
    ].map((source) => ({ source, headers: privateHeaders }));
  },
};

export default config;
