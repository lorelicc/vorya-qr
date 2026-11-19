import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageRenderer } from "@/components/page/PageRenderer";
import type { PublicPage } from "@/lib/page-types";

/**
 * Hosted page. Reached through /r/{slug} (proxy.ts rewrites page destinations here after the
 * backend counted the scan); the public URL stays /r/{slug}.
 */
export const dynamic = "force-dynamic";
const apiBase = () => process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

async function load(slug: string): Promise<PublicPage | null> {
  if (!/^[A-Za-z0-9]{7}$/.test(slug)) return null;
  const response = await fetch(`${apiBase()}/api/public/pages/${slug}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  return response.ok ? ((await response.json()) as PublicPage) : null;
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "QR non attivo", robots: { index: false } };
  const { page, files, company } = data;
  const header = page.blocks.find((b) => b.type === "header");
  const title =
    page.settings.og.title || (header?.type === "header" && header.title) || company.name;
  const ogImage = page.settings.og.image_file_id
    ? files[page.settings.og.image_file_id]?.urls.large
    : undefined;
  return {
    title: { absolute: title },
    description: page.settings.og.description || undefined,
    robots: page.settings.indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description: page.settings.og.description || undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function HostedPage({ params }: Params) {
  const data = await load((await params).slug);
  if (!data) notFound();
  return <PageRenderer page={data.page} files={data.files} slug={data.slug} />;
}
