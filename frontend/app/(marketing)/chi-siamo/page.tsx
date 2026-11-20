import { Bullets, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { SITE, pageMetadata } from "@/lib/site/config";

export const metadata = pageMetadata({
  title: "Chi siamo: Vorya QR, a Vorya product",
  description:
    "Vorya QR è un prodotto di Vorya: link brevi e codici QR in italiano, senza pubblicità, con una promessa semplice: i tuoi QR non smettono mai di funzionare.",
  path: "/chi-siamo",
});

export default function AboutPage() {
  return (
    <>
      <Crumbs items={[{ label: "Chi siamo", href: "/chi-siamo" }]} />
      <Hero
        eyebrow="Chi siamo"
        title="Vorya QR è un prodotto Vorya"
        lead="Costruiamo strumenti semplici per chi lavora: link, QR, firme. Fatti in Italia, in italiano."
        art="italy"
      />
      <Section title="Cosa ci sta a cuore">
        <Bullets
          items={[
            "I tuoi QR non smettono mai di funzionare",
            "Niente pubblicità, mai",
            "Prezzi chiari, in euro, senza vincoli",
            "Privacy: nessun indirizzo IP salvato nelle statistiche",
          ]}
        />
        <p style={{ marginTop: "var(--space-6)" }}>
          Vorya QR fa parte della famiglia di prodotti <a href={SITE.parent.url}>Vorya</a>.
        </p>
      </Section>
      <CtaBand title="Parliamone" text="Scrivici: rispondiamo noi, in italiano." />
    </>
  );
}
