import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site/config";
import { FEATURES, SOLUTIONS, TYPES, verifiedAlternatives } from "@/lib/site/content";
import { allGuides } from "@/lib/site/guides";

/** Site + guides. Drafts and unverified comparisons stay out (they are noindex as well). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed = [
    "/",
    "/funzionalita",
    "/prezzi",
    "/link-brevi",
    "/genera",
    "/qr-code",
    "/soluzioni",
    "/guide",
    "/chi-siamo",
    "/contatti",
  ];
  const paths = [
    ...fixed,
    ...FEATURES.filter((f) => f.page).map((f) => `/funzionalita/${f.slug}`),
    ...TYPES.map((t) => `/qr-code/${t.slug}`),
    ...SOLUTIONS.map((s) => `/soluzioni/${s.slug}`),
    ...verifiedAlternatives().map((a) => `/alternative/${a.slug}`),
  ];
  const guides = (await allGuides()).filter((g) => !g.meta.draft);
  return [
    ...paths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : path === "/prezzi" ? 0.9 : 0.7,
    })),
    ...guides.map((g) => ({
      url: absoluteUrl(`/guide/${g.slug}`),
      lastModified: new Date(g.meta.date),
      priority: 0.6,
    })),
  ];
}
