import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/components/layout/Brand";
import { LegalFooter } from "@/components/layout/LegalFooter";
import { LEGAL } from "@/lib/legal";
import styles from "./legal.module.css";

type Params = { params: Promise<{ document: string }> };

export function generateStaticParams() {
  return Object.keys(LEGAL).map((document) => ({ document }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const doc = LEGAL[(await params).document];
  return { title: doc?.title ?? "Documento" };
}

export default async function LegalPage({ params }: Params) {
  const doc = LEGAL[(await params).document];
  if (!doc) notFound();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <article className={styles.article}>
        <h1>{doc.title}</h1>
        <p className={styles.updated}>{doc.updated}</p>
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
      <LegalFooter />
    </div>
  );
}
