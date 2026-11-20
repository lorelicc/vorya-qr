import { Bullets, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { HeroScene } from "@/components/site/scenes";
import { SITE, pageMetadata } from "@/lib/site/config";

export const metadata = pageMetadata({
  title: "Chi siamo: Vorya QR, a Vorya product",
  description:
    "Vorya QR è un prodotto di Vorya: link brevi e codici QR in italiano, senza pubblicità, con una promessa semplice: dirti le cose chiaramente, prima di stampare.",
  path: "/chi-siamo",
});

export default function AboutPage() {
  return (
    <>
      <Crumbs tone="dark" items={[{ label: "Chi siamo", href: "/chi-siamo" }]} />
      <Hero
        eyebrow="Chi siamo"
        title="Vorya QR è un prodotto Vorya"
        lead="Costruiamo strumenti semplici per chi lavora: link, QR, firme. Fatti in Italia, in italiano."
        art="italy"
        scene={<HeroScene />}
        tone="dark"
      />
      <Section title="Cosa ci sta a cuore">
        <Bullets
          items={[
            "Stampi una volta, cambi quando vuoi",
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
