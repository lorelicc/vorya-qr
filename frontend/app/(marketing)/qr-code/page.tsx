import { Card, Cards, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { pageMetadata } from "@/lib/site/config";
import { TYPES } from "@/lib/site/content";

export const metadata = pageMetadata({
  title: "Tipi di QR code: sito web, vCard, menu, PDF, Wi-Fi e altri",
  description:
    "Tutti i tipi di QR code che puoi creare con Vorya QR: statici gratuiti e dinamici modificabili, per sito web, vCard, PDF, menu, Wi-Fi, WhatsApp e altro.",
  path: "/qr-code",
});

export default function TypesIndex() {
  const statics = TYPES.filter((t) => t.kind === "statico");
  const rest = TYPES.filter((t) => t.kind !== "statico");
  return (
    <>
      <Crumbs items={[{ label: "Tipi di QR", href: "/qr-code" }]} />
      <Hero
        eyebrow="Tipi di QR"
        title="Un QR code per ogni cosa che vuoi condividere"
        lead="I QR statici sono gratuiti e funzionano per sempre. I QR dinamici si modificano dopo la stampa e mostrano le scansioni."
        art="website"
      />
      <Section title="Dinamici e statici" lead="Sito web e vCard esistono in entrambe le versioni.">
        <Cards>
          {rest.map((t, i) => (
            <Card
              key={t.slug}
              title={t.label}
              text={t.lead}
              art={t.art}
              href={`/qr-code/${t.slug}`}
              delay={i * 40}
            />
          ))}
        </Cards>
      </Section>
      <Section tone="soft" title="Solo statici" lead="Gratis, per sempre, senza registrarti.">
        <Cards>
          {statics.map((t, i) => (
            <Card
              key={t.slug}
              title={t.label}
              text={t.lead}
              art={t.art}
              href={`/qr-code/${t.slug}`}
              delay={i * 40}
            />
          ))}
        </Cards>
      </Section>
      <CtaBand
        title="Non sai quale scegliere?"
        text="Inizia dal generatore gratuito oppure prova tutti i tipi per 14 giorni."
      />
    </>
  );
}
