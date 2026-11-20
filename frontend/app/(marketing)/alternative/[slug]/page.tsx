import { notFound } from "next/navigation";
import { Bullets, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { ALTERNATIVES, alternativeBySlug } from "@/lib/site/content";
import { pageMetadata } from "@/lib/site/config";

export const dynamicParams = false;
export const generateStaticParams = () => ALTERNATIVES.map((a) => ({ slug: a.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = alternativeBySlug((await params).slug);
  if (!a) return {};
  return pageMetadata({
    title: `Alternativa a ${a.name}: confronto con Vorya QR`,
    description: `Confronto onesto tra ${a.name} e Vorya QR: piano gratuito, QR dinamici, prezzi e lingua.`,
    path: `/alternative/${a.slug}`,
    noindex: !a.verified, // stays out of search engines until every claim has been verified
  });
}

export default async function AlternativePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = alternativeBySlug((await params).slug);
  if (!a) notFound();
  return (
    <>
      <Crumbs items={[{ label: `Alternativa a ${a.name}`, href: `/alternative/${a.slug}` }]} />
      <Hero
        eyebrow="Confronto"
        title={`Alternativa a ${a.name}`}
        lead={`Cosa cambia scegliendo Vorya QR al posto di ${a.name}. Solo fatti verificabili, con la fonte.`}
        art="alternative"
      />
      {!a.verified && (
        <Section>
          <p
            role="note"
            style={{
              padding: "var(--space-4)",
              background: "var(--color-warning-soft)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <strong>Contenuto in revisione.</strong> Le affermazioni su {a.name} vanno ancora
            verificate: questa pagina non è indicizzata.
          </p>
        </Section>
      )}
      <Section title={`Cosa dice il mercato su ${a.name}`}>
        <Bullets items={a.claims.map((c) => c.text)} />
        <p
          style={{
            marginTop: "var(--space-4)",
            fontSize: "var(--fs-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          {a.lastUpdated ? `Ultimo aggiornamento: ${a.lastUpdated}. ` : ""}
          Fonti:{" "}
          {a.sources.map((s) => (
            <a key={s.url} href={s.url} rel="nofollow noopener" target="_blank">
              {s.label}
              {s.checked ? ` (verificata il ${s.checked})` : ""}
            </a>
          ))}
        </p>
      </Section>
      <Section tone="soft" title="Cosa offre Vorya QR">
        <Bullets items={a.vorya} />
      </Section>
      <CtaBand
        title="Provalo, poi decidi"
        text="14 giorni con tutte le funzioni, senza carta di credito. Poi il piano Free per sempre."
      />
    </>
  );
}
