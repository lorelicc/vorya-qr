import Link from "next/link";
import { Card, Cards, CtaBand, FaqList, Section } from "@/components/site/blocks";
import { Counter } from "@/components/site/Counter";
import { Guarantee } from "@/components/site/Guarantee";
import { MockDashboard, MockEditor, MockStats } from "@/components/site/Mockups";
import { PlansPreview } from "@/components/site/PlansPreview";
import { Reveal } from "@/components/site/Reveal";
import { SiteArt } from "@/components/site/art/SiteArt";
import { HeroGenerator } from "@/components/site/generator/HeroGenerator";
import { ButtonLink } from "@/components/ui";
import { pageMetadata } from "@/lib/site/config";
import { FAQ, FEATURES, HOME, MESSAGES, SOCIAL, SOLUTIONS, featurePath } from "@/lib/site/content";
import { FEATURE_ART } from "@/lib/site/feature-art";
import styles from "@/components/site/home.module.css";

export const metadata = pageMetadata({
  title: "Link brevi e codici QR, in italiano e senza pubblicità",
  description: HOME.hero.lead,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroCopy}>
            <h1>{HOME.hero.title}</h1>
            <p>{HOME.hero.lead}</p>
            <div className={styles.heroArt} aria-hidden="true">
              <SiteArt name="guarantee" size={240} />
            </div>
          </div>
          <HeroGenerator />
          <Counter label="QR creati con Vorya QR" />
        </div>
      </section>

      <Section title="Perché Vorya QR" lead="Sei cose che non trovi tutte insieme altrove.">
        <Cards>
          {MESSAGES.map((m, i) => (
            <Card key={m.key} title={m.title} text={m.text} art={m.art} delay={i * 50} />
          ))}
        </Cards>
      </Section>

      <Section
        id="funzioni"
        tone="soft"
        title="Tutto quello che ti serve"
        lead="Dal link breve alla carta dei vini, senza strumenti separati."
      >
        <div className={styles.showcase}>
          <Reveal>
            <h3>Link e QR in una dashboard</h3>
            <p>
              Incolla un link, ottieni l’indirizzo breve e genera il QR quando vuoi. Cartelle, tag e
              ricerca per non perderti.
            </p>
            <MockDashboard />
          </Reveal>
          <Reveal delay={80}>
            <h3>Editor con anteprima dal vivo</h3>
            <p>
              Pagine per vCard, menu, PDF, musica e link in bio, con il controllo automatico di
              leggibilità del QR.
            </p>
            <MockEditor />
          </Reveal>
          <Reveal delay={160}>
            <h3>Statistiche chiare</h3>
            <p>Scansioni, dispositivi e paesi. Nessun indirizzo IP viene salvato.</p>
            <MockStats />
          </Reveal>
        </div>
        <div style={{ marginTop: "var(--space-8)" }}>
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
        </div>
      </Section>

      <Section title="Come funziona" lead="Dal primo QR a stampa e statistiche in tre passi.">
        <ol className={styles.steps}>
          {HOME.steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 80}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section
        tone="soft"
        title="Per ogni settore"
        lead="Ristoranti, cantine, eventi, agenzie, negozi e immobiliari."
      >
        <Cards>
          {SOLUTIONS.map((s, i) => (
            <Card
              key={s.slug}
              title={s.label}
              text={s.problem}
              art={s.art}
              href={`/soluzioni/${s.slug}`}
              delay={i * 40}
            />
          ))}
        </Cards>
      </Section>

      <Section
        title="Prezzi chiari"
        lead="Dal piano Free per sempre ad Agency. In euro, mese per mese o all’anno."
      >
        <PlansPreview />
        <p style={{ marginTop: "var(--space-5)" }}>
          <ButtonLink href="/prezzi" variant="secondary">
            Vedi tutti i prezzi
          </ButtonLink>
        </p>
        <div style={{ marginTop: "var(--space-8)" }}>
          <Guarantee />
        </div>
      </Section>

      {(SOCIAL.testimonials.length > 0 || SOCIAL.logos.length > 0) && (
        <Section title="Dicono di noi">
          {SOCIAL.testimonials.map((t) => (
            <blockquote key={t.author}>
              {t.quote}
              <footer>{t.author}</footer>
            </blockquote>
          ))}
        </Section>
      )}

      <FaqList items={FAQ.home} />
      <CtaBand title={HOME.finalCta.title} text={HOME.finalCta.text} />
      <p className={styles.small}>
        <Link href="/genera">Genera un QR gratis</Link> · <Link href="/guide">Guide</Link>
      </p>
    </>
  );
}
