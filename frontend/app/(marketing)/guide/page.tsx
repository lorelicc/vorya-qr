import Link from "next/link";
import { Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { pageMetadata } from "@/lib/site/config";
import { allGuides } from "@/lib/site/guides";
import styles from "@/components/site/guide.module.css";

export const metadata = pageMetadata({
  title: "Guide sui QR code: statici, dinamici, menu digitali e statistiche",
  description:
    "Guide pratiche in italiano per usare al meglio i QR code: differenze tra statico e dinamico, menu digitale per ristoranti, misurare le scansioni.",
  path: "/guide",
});

export default async function GuidesIndex() {
  const guides = await allGuides();
  const categories = [...new Set(guides.map((g) => g.meta.category))];
  return (
    <>
      <Crumbs items={[{ label: "Guide", href: "/guide" }]} />
      <Hero
        eyebrow="Guide"
        title="Guide pratiche sui QR code"
        lead="Poche cose chiare, in italiano, per usare i QR senza pentirti dopo la stampa."
        art="guide"
      />
      {categories.map((category) => (
        <Section key={category} title={category}>
          <div className={styles.list}>
            {guides
              .filter((g) => g.meta.category === category)
              .map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}`} className={styles.item}>
                  {g.meta.draft && <span className={styles.draft}>BOZZA DA REVISIONARE</span>}
                  <h3>{g.meta.title}</h3>
                  <p>{g.meta.description}</p>
                  <small>
                    {g.meta.readingMinutes ? `${g.meta.readingMinutes} min di lettura` : ""}
                  </small>
                </Link>
              ))}
          </div>
        </Section>
      ))}
      <CtaBand title="Metti in pratica" text="Crea il tuo primo QR gratis: ci vuole un minuto." />
    </>
  );
}
