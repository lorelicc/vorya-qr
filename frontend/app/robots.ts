import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The app, the API and the users' own pages are never for search engines.
        disallow: ["/app/", "/account/", "/admin/", "/api/", "/companies", "/p/", "/f/", "/r/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
