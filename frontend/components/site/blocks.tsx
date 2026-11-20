import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui";
import { absoluteUrl } from "@/lib/site/config";
import type { FaqItem } from "@/lib/site/content";
import { JsonLd } from "./JsonLd";
import { Reveal } from "./Reveal";
import { SiteArt } from "./art/SiteArt";
import styles from "./blocks.module.css";

export function Crumbs({
  items,
  tone = "mint",
}: {
  items: { label: string; href: string }[];
  /** Same tone as the page header below: the bar blends into it. */
  tone?: "mint" | "dark" | "indigo" | "sun";
}) {
  const all = [{ label: "Home", href: "/" }, ...items];
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: absoluteUrl(c.href),
          })),
        }}
      />
      <div className={styles.crumbsBar} data-tone={tone}>
        <nav aria-label="Percorso" className={styles.crumbs}>
          {all.map((c, i) =>
            i === all.length - 1 ? (
              <span key={c.href} aria-current="page">
                {c.label}
              </span>
            ) : (
              <span key={c.href}>
                <Link href={c.href}>{c.label}</Link> /{" "}
              </span>
            ),
          )}
        </nav>
      </div>
    </>
  );
}

export function Hero({
  eyebrow,
  title,
  lead,
  actions,
  art,
  scene,
  tone = "mint",
  children,
}: {
  eyebrow?: string;
  title: string;
  lead: string;
  actions?: ReactNode;
  art?: string;
  /** An animated scene (components/site/scenes) shown instead of the static illustration. */
  scene?: ReactNode;
  /** Background of the header area: every page family has its own colour. */
  tone?: "mint" | "dark" | "indigo" | "sun";
  children?: ReactNode;
}) {
  return (
    <section className={styles.hero} data-tone={tone}>
      <div className={styles.container}>
        <div className={styles.heroText}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1>{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        {scene ? (
          <div className={styles.heroScene}>{scene}</div>
        ) : (
          art && (
            <div className={styles.heroArt}>
              <SiteArt name={art} size={320} />
            </div>
          )
        )}
      </div>
      {children}
    </section>
  );
}

export type SectionTone =
  | "soft"
  | "mint"
  | "forest"
  | "sun"
  | "lilac"
  | "peach"
  | "indigo"
  | "lime";

export function Section({
  id,
  title,
  lead,
  tone,
  children,
}: {
  id?: string;
  title?: string;
  lead?: string;
  tone?: SectionTone;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} data-tone={tone}>
      <div className={styles.container}>
        {title && (
          <Reveal className={styles.sectionHead}>
            <h2>{title}</h2>
            {lead && <p className={styles.lead}>{lead}</p>}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className={styles.cards}>{children}</div>;
}

export function Card({
  title,
  text,
  art,
  href,
  delay = 0,
}: {
  title: string;
  text?: string;
  art?: string;
  href?: string;
  delay?: number;
}) {
  const body = (
    <>
      {art && (
        <div className={styles.cardArt}>
          <SiteArt name={art} size={132} />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </>
  );
  return (
    <Reveal delay={delay} className={styles.cardWrap}>
      {href ? (
        <Link href={href} className={styles.card}>
          {body}
        </Link>
      ) : (
        <div className={styles.card}>{body}</div>
      )}
    </Reveal>
  );
}

export function FaqList({
  items,
  title = "Domande frequenti",
  tone,
}: {
  items: FaqItem[];
  title?: string;
  tone?: SectionTone;
}) {
  return (
    <Section title={title} tone={tone}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((i) => ({
            "@type": "Question",
            name: i.q,
            acceptedAnswer: { "@type": "Answer", text: i.a },
          })),
        }}
      />
      <div className={styles.faq}>
        {items.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/** One FAQ category: title and illustration on the left, the questions on the right. */
export function FaqGroup({
  id,
  title,
  lead,
  art,
  items,
  tone,
}: {
  id: string;
  title: string;
  lead: string;
  art: string;
  items: FaqItem[];
  tone: SectionTone;
}) {
  return (
    <section id={id} className={styles.section} data-tone={tone}>
      <div className={`${styles.container} ${styles.faqSplit}`}>
        <Reveal className={styles.faqHead}>
          <SiteArt name={art} size={150} />
          <h2>{title}</h2>
          <p className={styles.lead}>{lead}</p>
        </Reveal>
        <div className={styles.faq}>
          {items.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({
  title,
  text,
  event = "prova-gratis-cta",
}: {
  title: string;
  text: string;
  event?: string;
}) {
  return (
    <section className={styles.cta}>
      <div className={styles.container}>
        <Reveal>
          <h2>{title}</h2>
          <p>{text}</p>
          <div className={styles.actions}>
            <ButtonLink href="/register" data-umami-event={event}>
              Prova gratis
            </ButtonLink>
            <ButtonLink href="/prezzi" variant="secondary" className={styles.ctaSecondary}>
              Vedi i prezzi
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className={styles.bullets}>
      {items.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}
