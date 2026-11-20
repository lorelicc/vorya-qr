import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crumbs, CtaBand } from "@/components/site/blocks";
import { JsonLd } from "@/components/site/JsonLd";
import styles from "@/components/site/guide.module.css";
import { SITE, absoluteUrl, pageMetadata } from "@/lib/site/config";
import { guideHeadings, guideSlugs, loadGuide, slugify } from "@/lib/site/guides";

export const dynamicParams = false;
export const generateStaticParams = () => guideSlugs().map((slug) => ({ slug }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const g = await loadGuide((await params).slug);
  if (!g) return {};
  return pageMetadata({
    title: g.meta.title,
    description: g.meta.description,
    path: `/guide/${g.slug}`,
    noindex: g.meta.draft,
  });
}

const text = (children: React.ReactNode): string =>
  typeof children === "string"
    ? children
    : Array.isArray(children)
      ? children.map(text).join("")
      : "";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = await loadGuide((await params).slug);
  if (!g) notFound();
  const toc = guideHeadings(g.slug);
  const { Body, meta } = g;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: meta.title,
          description: meta.description,
          datePublished: meta.date,
          inLanguage: "it",
          mainEntityOfPage: absoluteUrl(`/guide/${g.slug}`),
          author: { "@type": "Organization", name: SITE.name },
          publisher: { "@type": "Organization", name: SITE.name },
        }}
      />
      <Crumbs
        items={[
          { label: "Guide", href: "/guide" },
          { label: meta.title, href: `/guide/${g.slug}` },
        ]}
      />
      <article className={styles.article}>
        <header>
          {meta.draft && <p className={styles.draft}>BOZZA DA REVISIONARE</p>}
          <p className={styles.category}>{meta.category}</p>
          <h1>{meta.title}</h1>
          <p className={styles.lead}>{meta.description}</p>
        </header>
        <div className={styles.layout}>
          <aside className={styles.toc} aria-label="In questa guida">
            <strong>In questa guida</strong>
            <ol>
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.title}</a>
                </li>
              ))}
            </ol>
          </aside>
          <div className={styles.prose}>
            <Body
              {...({
                components: {
                  h2: ({ children }: { children?: React.ReactNode }) => (
                    <h2 id={slugify(text(children))}>{children}</h2>
                  ),
                },
              } as object)}
            />
          </div>
        </div>
      </article>
      <CtaBand
        title="Pronto a provarlo?"
        text="Crea il tuo primo QR: 14 giorni con tutte le funzioni, poi il piano Free per sempre."
      />
    </>
  );
}
