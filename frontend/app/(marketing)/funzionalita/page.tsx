import Link from "next/link";
import { Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { HeroScene } from "@/components/site/scenes";
import { Reveal } from "@/components/site/Reveal";
import { SiteArt } from "@/components/site/art/SiteArt";
import { FEATURE_ART } from "@/lib/site/feature-art";
import { pageMetadata } from "@/lib/site/config";
import { FEATURES, featurePath } from "@/lib/site/content";
import styles from "@/components/site/bento.module.css";

const TONES = ["white", "sun", "lilac", "white", "peach", "white", "indigo", "white"] as const;

export const metadata = pageMetadata({
  title: "Funzionalità: link brevi, QR dinamici, pagine, statistiche e altro",
  description:
    "Tutto quello che puoi fare con Vorya QR: link brevi, QR dinamici e statici, pagine ospitate, design del QR, statistiche, multi-azienda, importazione da CSV, menu e carta dei vini.",
  path: "/funzionalita",
});

export default function FeaturesIndex() {
  return (
    <>
      <Crumbs tone="dark" items={[{ label: "Funzionalità", href: "/funzionalita" }]} />
      <Hero
        eyebrow="Funzionalità"
        title="Tutto per link e QR, in un solo posto"
        lead="Dal link breve alla carta dei vini: strumenti pensati per chi stampa, condivide e vuole misurare."
        art="pages"
        scene={<HeroScene />}
        tone="dark"
      />
      <Section>
        <h2 className="visually-hidden">Tutte le funzionalità</h2>
        <div className={styles.bento}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.slug} delay={i * 50} className={styles.bentoItem}>
              <article id={f.slug} className={styles.bentoCard} data-tone={TONES[i % TONES.length]}>
                <div className={styles.bentoText}>
                  <h3>{f.page ? <Link href={featurePath(f)}>{f.label}</Link> : f.label}</h3>
                  <p>{f.text}</p>
                  <ul>
                    {f.bullets.slice(0, 3).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  {f.page && (
                    <Link href={featurePath(f)} className={styles.bentoLink}>
                      Scopri di più →
                    </Link>
                  )}
                </div>
                <div className={styles.bentoArt} aria-hidden="true">
                  <SiteArt name={FEATURE_ART[f.slug]} size={170} />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>
      <CtaBand
        title="Provalo con i tuoi dati"
        text="14 giorni con tutte le funzioni, senza carta di credito."
      />
    </>
  );
}
