import { notFound } from "next/navigation";
import { solutionScene } from "@/components/site/scenes/for";
import {
  Bullets,
  Card,
  Cards,
  Crumbs,
  CtaBand,
  FaqList,
  Hero,
  Section,
} from "@/components/site/blocks";
import { ButtonLink } from "@/components/ui";
import { SOLUTIONS, TYPES, solutionBySlug } from "@/lib/site/content";
import { pageMetadata } from "@/lib/site/config";

export const dynamicParams = false;
export const generateStaticParams = () => SOLUTIONS.map((s) => ({ settore: s.slug }));

export async function generateMetadata({ params }: { params: Promise<{ settore: string }> }) {
  const s = solutionBySlug((await params).settore);
  return s
    ? pageMetadata({ title: s.h1, description: `${s.solution}`, path: `/soluzioni/${s.slug}` })
    : {};
}

export default async function SolutionPage({ params }: { params: Promise<{ settore: string }> }) {
  const s = solutionBySlug((await params).settore);
  if (!s) notFound();
  const types = TYPES.filter((t) => s.types.includes(t.slug));
  return (
    <>
      <Crumbs
        items={[
          { label: "Soluzioni", href: "/soluzioni" },
          { label: s.label, href: `/soluzioni/${s.slug}` },
        ]}
      />
      <Hero
        eyebrow={s.label}
        title={s.h1}
        lead={s.solution}
        art={s.art}
        scene={solutionScene(s.slug)}
        actions={
          <ButtonLink href="/register" data-umami-event={`soluzione-${s.slug}-prova`}>
            Prova gratis
          </ButtonLink>
        }
      />
      <Section title="Il problema">
        <p style={{ fontSize: "var(--fs-lg)", maxWidth: "62ch", lineHeight: 1.6 }}>{s.problem}</p>
      </Section>
      <Section tone="sun" title="Come ti aiuta Vorya QR">
        <Bullets items={s.bullets} />
      </Section>
      <Section title="I QR consigliati">
        <Cards>
          {types.map((t, i) => (
            <Card
              key={t.slug}
              title={t.label}
              text={t.lead}
              art={t.art}
              href={`/qr-code/${t.slug}`}
              delay={i * 50}
            />
          ))}
        </Cards>
      </Section>
      <FaqList items={s.faq} />
      <CtaBand
        title={`Vorya QR per ${s.label.toLowerCase()}`}
        text="Prova gratis per 14 giorni. I tuoi QR non smettono mai di funzionare."
        event={`soluzione-${s.slug}-cta`}
      />
    </>
  );
}
