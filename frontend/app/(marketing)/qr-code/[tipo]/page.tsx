import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Bullets,
  Card,
  Cards,
  Crumbs,
  CtaBand,
  FaqList,
  Hero,
  Section,
} from "@/components/site/blocks";
import { PublicGenerator, type GeneratorType } from "@/components/site/generator/PublicGenerator";
import { JsonLd } from "@/components/site/JsonLd";
import { ButtonLink } from "@/components/ui";
import { SOLUTIONS, TYPES, typeBySlug } from "@/lib/site/content";
import { absoluteUrl, pageMetadata } from "@/lib/site/config";

export const dynamicParams = false;
export const generateStaticParams = () => TYPES.map((t) => ({ tipo: t.slug }));

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }) {
  const t = typeBySlug((await params).tipo);
  if (!t) return {};
  return pageMetadata({
    title: `${t.h1}: gratis, senza pubblicità`,
    description: `${t.lead} Genera il tuo QR code in italiano con Vorya QR.`,
    path: `/qr-code/${t.slug}`,
  });
}

const KIND = {
  statico: "QR statico: gratuito, per sempre, non modificabile.",
  dinamico: "QR dinamico: lo modifichi dopo la stampa e vedi le scansioni.",
  entrambi: "Disponibile statico (gratis) e dinamico (modificabile, con statistiche).",
} as const;

export default async function TypePage({ params }: { params: Promise<{ tipo: string }> }) {
  const t = typeBySlug((await params).tipo);
  if (!t) notFound();
  const generatorType = (t.generator === "vcard" ? "vcard_static" : t.generator) as GeneratorType;
  const related = SOLUTIONS.filter((s) => t.solutions.includes(s.slug));
  const dynamicOnly = t.kind === "dinamico";
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: t.h1,
          description: t.lead,
          url: absoluteUrl(`/qr-code/${t.slug}`),
        }}
      />
      <Crumbs
        items={[
          { label: "Tipi di QR", href: "/qr-code" },
          { label: t.label, href: `/qr-code/${t.slug}` },
        ]}
      />
      <Hero
        eyebrow={KIND[t.kind as keyof typeof KIND]}
        title={t.h1}
        lead={t.lead}
        art={t.art}
        actions={
          dynamicOnly ? (
            <ButtonLink href="/register" data-umami-event={`landing-${t.slug}-prova`}>
              Crealo gratis
            </ButtonLink>
          ) : undefined
        }
      />
      <Section
        title={
          dynamicOnly
            ? "Provalo: l'anteprima del QR"
            : `Genera il tuo QR ${t.label.toLowerCase()} gratis`
        }
        lead={
          dynamicOnly
            ? `Il QR per ${t.label.toLowerCase()} è dinamico: punta a una tua pagina. Qui sotto trovi il generatore dei QR statici; per questo tipo crea un account gratuito.`
            : "Nessuna registrazione, nessuna filigrana."
        }
      >
        <PublicGenerator
          initialType={generatorType}
          landing={`/qr-code/${t.slug}`}
          compact={false}
        />
      </Section>
      <Section tone="soft" title="Quando usarlo">
        <Bullets items={t.useCases} />
      </Section>
      {related.length > 0 && (
        <Section title="Soluzioni che lo usano">
          <Cards>
            {related.map((s) => (
              <Card key={s.slug} title={s.label} art={s.art} href={`/soluzioni/${s.slug}`} />
            ))}
          </Cards>
        </Section>
      )}
      <FaqList items={t.faq} title={`Domande su ${t.label}`} />
      <Section>
        <p>
          Vuoi capire la differenza tra i due tipi? Leggi{" "}
          <Link href="/guide/qr-statico-o-dinamico">QR statico o dinamico</Link>.
        </p>
      </Section>
      <CtaBand
        title="Pronto a crearlo?"
        text="Prova gratis per 14 giorni, poi il piano Free per sempre."
        event={`landing-${t.slug}-cta`}
      />
    </>
  );
}
