import { ArrowRight, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/site/blocks";
import { LegalScene } from "@/components/site/scenes";
import { LEGAL } from "@/lib/legal";
import styles from "./legal.module.css";

type Params = { params: Promise<{ document: string }> };

export function generateStaticParams() {
  return Object.keys(LEGAL).map((document) => ({ document }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const doc = LEGAL[(await params).document];
  // Placeholder texts: not indexed until the owner has completed and reviewed them.
  return { title: doc?.title ?? "Documento", description: doc?.intro, robots: { index: false } };
}

export default async function LegalPage({ params }: Params) {
  const slug = (await params).document;
  const doc = LEGAL[slug];
  if (!doc) notFound();
  const pad = (n: number) => String(n + 1).padStart(2, "0");
  return (
    <>
      <Crumbs tone="indigo" items={[{ label: doc.title, href: `/legal/${slug}` }]} />
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div>
            <p className={styles.eyebrow}>{doc.eyebrow}</p>
            <h1>{doc.title}</h1>
            <p className={styles.intro}>{doc.intro}</p>
            <small>Ultimo aggiornamento: {doc.updated}</small>
          </div>
          <LegalScene kind={doc.scene} />
        </div>
      </section>
      <div className={styles.content}>
        <aside>
          <nav aria-label="Documenti legali">
            {Object.entries(LEGAL).map(([key, d]) => (
              <Link
                key={key}
                href={`/legal/${key}`}
                aria-current={key === slug ? "page" : undefined}
              >
                {d.short}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <Link href="/contatti" className={styles.contact}>
            <Mail size={20} aria-hidden="true" />
            <strong>Parliamone.</strong>
            <span>Dubbi sul servizio o sui tuoi dati?</span>
            <b>Scrivici →</b>
          </Link>
        </aside>
        <article>
          <nav aria-label="Indice del documento" className={styles.index}>
            <strong>In questa pagina</strong>
            {doc.sections.map((section, i) => (
              <a key={section.heading} href={`#sezione-${i + 1}`}>
                {pad(i)} · {section.heading}
              </a>
            ))}
          </nav>
          {doc.sections.map((section, i) => (
            <section key={section.heading} id={`sezione-${i + 1}`}>
              <h2>
                <span>{pad(i)}</span>
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <div className={styles.help}>
            <Mail size={22} aria-hidden="true" />
            <div>
              <h2>Hai una domanda?</h2>
              <p>
                Usa la pagina <Link href="/contatti">Contatti</Link>: ti rispondiamo in italiano.
              </p>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
