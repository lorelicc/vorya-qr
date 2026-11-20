import { Check } from "lucide-react";
import Link from "next/link";
import { Card, Cards, CtaBand, FaqList, Section } from "@/components/site/blocks";
import { Counter } from "@/components/site/Counter";
import { HowItWorks } from "@/components/site/HowItWorks";
import { PlansPreview } from "@/components/site/PlansPreview";
import { Reveal } from "@/components/site/Reveal";
import { HeroScene, PagesScene, PlanScene, ReportScene } from "@/components/site/scenes";
import { HeroGenerator } from "@/components/site/generator/HeroGenerator";
import { ButtonLink } from "@/components/ui";
import { pageMetadata } from "@/lib/site/config";
import { FAQ, FEATURES, HOME, SOCIAL, SOLUTIONS, featurePath } from "@/lib/site/content";
import { FEATURE_ART } from "@/lib/site/feature-art";
import styles from "@/components/site/home.module.css";

export const metadata = pageMetadata({
  title: "Link brevi e codici QR, in italiano e senza pubblicità",
  description: HOME.hero.lead,
  path: "/",
});

const S = HOME.sections;

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.pill}>{HOME.hero.eyebrow}</p>
              <h1>{HOME.hero.title}</h1>
              <p className={styles.heroLead}>{HOME.hero.lead}</p>
              <div className={styles.heroActions}>
                <ButtonLink href="/register" data-umami-event="hero-prova-gratis">
                  {HOME.hero.cta}
                </ButtonLink>
                <ButtonLink href="#genera" variant="secondary" className={styles.ghost}>
                  Genera un QR gratis
                </ButtonLink>
              </div>
            </div>
            <div className={styles.heroScene}>
              <HeroScene />
            </div>
          </div>
          <div id="genera" className={styles.generator}>
            <HeroGenerator />
          </div>
          <Counter label="QR creati con Vorya QR" />
        </div>
      </section>

      <section className={styles.trust} aria-label="Perché Vorya QR">
        <ul className={styles.container}>
          {HOME.trust.map((t) => (
            <li key={t}>
              <Check size={18} aria-hidden="true" /> {t}
            </li>
          ))}
        </ul>
      </section>

      <Section title={S.how.title} lead={S.how.lead}>
        <HowItWorks />
      </Section>

      <Section id="funzioni" tone="indigo" title={S.features.title} lead={S.features.lead}>
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

      <Section tone="sun">
        <div className={styles.split}>
          <Reveal className={styles.splitCopy}>
            <p className={styles.kicker}>{S.sectors.kicker}</p>
            <h2>{S.sectors.title}</h2>
            <p>{S.sectors.text}</p>
            <p>
              <ButtonLink href="/soluzioni">{S.sectors.cta}</ButtonLink>
            </p>
          </Reveal>
          <Reveal delay={80}>
            <PagesScene />
          </Reveal>
        </div>
        <div className={styles.afterSplit}>
          <h3 className={styles.miniTitle}>{S.sectors.lead}</h3>
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
        </div>
      </Section>

      <Section tone="forest">
        <div className={`${styles.split} ${styles.reverse}`}>
          <Reveal className={styles.splitCopy}>
            <p className={`${styles.kicker} ${styles.kickerLight}`}>{S.guarantee.kicker}</p>
            <h2>{S.guarantee.title}</h2>
            <p>{S.guarantee.text}</p>
            <ul className={styles.points}>
              {S.guarantee.points.map((p) => (
                <li key={p}>
                  <Check size={18} aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={80}>
            <PlanScene />
          </Reveal>
        </div>
      </Section>

      <Section tone="peach">
        <div className={styles.split}>
          <Reveal className={styles.splitCopy}>
            <p className={styles.kicker}>{S.report.kicker}</p>
            <h2>{S.report.title}</h2>
            <p>{S.report.text}</p>
            <p>
              <ButtonLink href="/prezzi" variant="secondary">
                {S.report.cta}
              </ButtonLink>
            </p>
          </Reveal>
          <Reveal delay={80}>
            <ReportScene />
          </Reveal>
        </div>
      </Section>

      <Section title={S.pricing.title} lead={S.pricing.lead}>
        <PlansPreview />
        <p style={{ marginTop: "var(--space-5)" }}>
          <ButtonLink href="/prezzi" variant="secondary">
            Vedi tutti i prezzi
          </ButtonLink>
        </p>
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

      <FaqList items={FAQ.home} tone="mint" />
      <CtaBand title={HOME.finalCta.title} text={HOME.finalCta.text} />
      <p className={styles.small}>
        <Link href="/genera">Genera un QR gratis</Link> · <Link href="/guide">Guide</Link>
      </p>
    </>
  );
}
