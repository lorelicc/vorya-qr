import { Bullets, Card, Cards, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { Reveal } from "@/components/site/Reveal";
import { SiteArt } from "@/components/site/art/SiteArt";
import { FEATURE_ART } from "@/lib/site/feature-art";
import { pageMetadata } from "@/lib/site/config";
import { FEATURES, featurePath } from "@/lib/site/content";

export const metadata = pageMetadata({
  title: "Funzionalità: link brevi, QR dinamici, pagine, statistiche e altro",
  description:
    "Tutto quello che puoi fare con Vorya QR: link brevi, QR dinamici e statici, pagine ospitate, design del QR, statistiche, multi-azienda, importazione da CSV, menu e carta dei vini.",
  path: "/funzionalita",
});

export default function FeaturesIndex() {
  return (
    <>
      <Crumbs items={[{ label: "Funzionalità", href: "/funzionalita" }]} />
      <Hero
        eyebrow="Funzionalità"
        title="Tutto per link e QR, in un solo posto"
        lead="Dal link breve alla carta dei vini: strumenti pensati per chi stampa, condivide e vuole misurare."
        art="pages"
      />
      <Section>
        <h2 className="visually-hidden">Tutte le funzionalità</h2>
        <Cards>
          {FEATURES.map((f, i) => (
            <Card
              key={f.slug}
              title={f.label}
              text={f.text}
              art={FEATURE_ART[f.slug]}
              href={featurePath(f)}
              delay={i * 40}
            />
          ))}
        </Cards>
      </Section>
      {FEATURES.filter((f) => !f.page).map((f) => (
        <Section key={f.slug} id={f.slug} tone="mint" title={f.title} lead={f.text}>
          <Reveal>
            <SiteArt name={FEATURE_ART[f.slug]} size={180} />
            <Bullets items={f.bullets} />
          </Reveal>
        </Section>
      ))}
      <CtaBand
        title="Provalo con i tuoi dati"
        text="14 giorni con tutte le funzioni, senza carta di credito."
      />
    </>
  );
}
