import { readdirSync } from "node:fs";
import path from "node:path";

export type GuideMeta = {
  title: string;
  description: string;
  category: string;
  date: string;
  /** Draft guides are labelled "BOZZA DA REVISIONARE", noindex and left out of the sitemap. */
  draft?: boolean;
  readingMinutes?: number;
};

const DIR = path.join(process.cwd(), "content", "guide");

export function guideSlugs(): string[] {
  try {
    return readdirSync(DIR)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""));
  } catch {
    return [];
  }
}

export async function loadGuide(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug) || !guideSlugs().includes(slug)) return null;
  const mod = await import(`@/content/guide/${slug}.mdx`);
  return { Body: mod.default as React.ComponentType, meta: mod.meta as GuideMeta, slug };
}

export async function allGuides() {
  const loaded = await Promise.all(guideSlugs().map(loadGuide));
  return loaded
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}
