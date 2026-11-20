import { Crumbs, CtaBand, FaqGroup, Hero } from "@/components/site/blocks";
import { JsonLd } from "@/components/site/JsonLd";
import { FaqScene } from "@/components/site/scenes";
import { pageMetadata } from "@/lib/site/config";
import { FAQ } from "@/lib/site/content";

export const metadata = pageMetadata({
  title: "Domande frequenti su link brevi, QR code, prezzi e privacy",
  description:
    "Risposte chiare su piani e prezzi, QR dinamici e statici, cosa succede se smetti di pagare, privacy e fatturazione.",
  path: "/faq",
});

const GROUPS = [
  { id: "piani", title: "Piani e prezzi", lead: "Quanto costa, come si paga, come si disdice.", art: "euro", tone: "mint", items: FAQ.pricing },
  { id: "qr", title: "QR e link", lead: "Come funzionano i codici statici e dinamici.", art: "dynamic", tone: "lilac", items: FAQ.qr },
  { id: "privacy", title: "Privacy e pubblicità", lead: "Cosa salviamo e cosa non salveremo mai.", art: "privacy", tone: "sun", items: FAQ.privacy },
  { id: "inizio", title: "Per iniziare", lead: "Gratis, per sempre, finché ti basta.", art: "noads", tone: "peach", items: FAQ.home },
] as const; // prettier-ignore

export default function FaqPage() {
  const all = GROUPS.flatMap((g) => g.items);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: all.map((i) => ({
            "@type": "Question",
            name: i.q,
            acceptedAnswer: { "@type": "Answer", text: i.a },
          })),
        }}
      />
      <Crumbs tone="indigo" items={[{ label: "Domande frequenti", href: "/faq" }]} />
      <Hero
        tone="indigo"
        eyebrow="Domande frequenti"
        title="Risposte chiare, senza giri di parole"
        lead="Piani, QR, privacy e fatture: se non trovi quello che cerchi, scrivici e ti rispondiamo in italiano."
        scene={<FaqScene />}
      />
      {GROUPS.map((g) => (
        <FaqGroup key={g.id} {...g} items={[...g.items]} tone={g.tone} />
      ))}
      <CtaBand
        title="Hai ancora un dubbio?"
        text="Scrivici: rispondiamo in italiano, di solito entro un giorno lavorativo."
      />
    </>
  );
}
