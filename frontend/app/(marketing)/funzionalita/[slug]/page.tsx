import { notFound } from "next/navigation";
import { Bullets, Card, Cards, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { MockDashboard, MockEditor, MockStats } from "@/components/site/Mockups";
import { FEATURE_ART } from "@/lib/site/feature-art";
import { pageMetadata } from "@/lib/site/config";
import { FEATURES, TYPES, featureBySlug } from "@/lib/site/content";

export const dynamicParams = false;
export const generateStaticParams = () =>
  FEATURES.filter((f) => f.page).map((f) => ({ slug: f.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const f = featureBySlug((await params).slug);
  return f
    ? pageMetadata({ title: f.title, description: f.text, path: `/funzionalita/${f.slug}` })
    : {};
}

const MOCK = {
  "link-brevi": MockDashboard,
  "qr-dinamici": MockEditor,
  "pagine-ospitate": MockEditor,
  statistiche: MockStats,
} as const;

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const f = featureBySlug((await params).slug);
  if (!f) notFound();
  const Mock = MOCK[f.slug as keyof typeof MOCK] ?? MockDashboard;
  const related = TYPES.slice(0, 3);
  return (
    <>
      <Crumbs
        items={[
          { label: "Funzionalità", href: "/funzionalita" },
          { label: f.label, href: `/funzionalita/${f.slug}` },
        ]}
      />
      <Hero eyebrow={f.label} title={f.title} lead={f.text} art={FEATURE_ART[f.slug]} />
      <Section title="In pratica">
        <Bullets items={f.bullets} />
        <div style={{ marginTop: "var(--space-8)" }}>
          <Mock />
        </div>
      </Section>
      <Section tone="soft" title="Funziona con tutti i tipi di QR">
        <Cards>
          {related.map((t) => (
            <Card
              key={t.slug}
              title={t.label}
              text={t.lead}
              art={t.art}
              href={`/qr-code/${t.slug}`}
            />
          ))}
        </Cards>
      </Section>
      <CtaBand title={f.title} text="Prova gratis per 14 giorni, poi il piano Free per sempre." />
    </>
  );
}
