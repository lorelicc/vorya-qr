import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/** Open Graph image in the Vorya style, generated from the page title (1200x630). */
export function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("title") ?? "Vorya QR";
  const title = raw.replace(/[\r\n]+/g, " ").slice(0, 90);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #f5faf7 0%, #d8fae9 100%)",
          color: "#091411",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#00e99a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
            }}
          >
            V
          </div>
          <span>
            vorya<span style={{ color: "#087f5b" }}>.qr</span>
          </span>
        </div>
        <div
          style={{
            fontSize: title.length > 48 ? 64 : 80,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 30, color: "#087f5b" }}>
          I tuoi QR non smettono mai di funzionare
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}
