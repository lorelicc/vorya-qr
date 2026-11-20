import { Card, Cards, Crumbs, CtaBand, Hero, Section } from "@/components/site/blocks";
import { PagesScene } from "@/components/site/scenes";
import { pageMetadata } from "@/lib/site/config";
import { SOLUTIONS } from "@/lib/site/content";

export const metadata = pageMetadata({
  title: "Soluzioni QR code per ristoranti, cantine, eventi, agenzie e negozi",
  description:
    "Come usano Vorya QR ristoranti, cantine, eventi, agenzie, negozi e immobiliari: menu digitali, carte dei vini, link brevi e report per i clienti.",
  path: "/soluzioni",
});

export default function SolutionsIndex() {
  return (
    <>
      <Crumbs tone="sun" items={[{ label: "Soluzioni", href: "/soluzioni" }]} />
      <Hero
        eyebrow="Soluzioni"
        title="Pensato per chi lavora con i QR"
        lead="Scegli il tuo settore e parti dai tipi di QR più utili."
        art="agency"
        scene={<PagesScene />}
        tone="sun"
      />
      <Section>
        <Cards>
          {SOLUTIONS.map((s, i) => (
            <Card
              key={s.slug}
              title={s.label}
              text={s.problem}
              art={s.art}
              href={`/soluzioni/${s.slug}`}
              delay={i * 50}
            />
          ))}
        </Cards>
      </Section>
      <CtaBand
        title="Il tuo settore non c'è?"
        text="I tipi di QR sono gli stessi: provali gratis e vedi cosa fa per te."
      />
    </>
  );
}
