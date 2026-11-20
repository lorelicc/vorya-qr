import type { Metadata } from "next";

/** Public site (qr.vorya.it). The domain comes from the environment: never hard-coded in pages. */
export const SITE = {
  name: "Vorya QR",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://qr.vorya.it").replace(/\/$/, ""),
  locale: "it_IT",
  /** i18n is structured for /en (dictionaries, hreflang) but only Italian content exists. */
  locales: ["it"] as const,
  defaultLocale: "it" as const,
  parent: { name: "Vorya", url: "https://vorya.it" },
} as const;

export const absoluteUrl = (path = "/") => `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;

export type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** Hidden from search engines (drafts, unverified comparisons). */
  noindex?: boolean;
};

/** Unique title/description, canonical, hreflang and a generated Open Graph image per page. */
export function pageMetadata({ title, description, path, noindex }: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const image = `${SITE.url}/og?title=${encodeURIComponent(title.slice(0, 90))}`;
  return {
    title,
    description,
    alternates: { canonical: url, languages: { it: url, "x-default": url } },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}
