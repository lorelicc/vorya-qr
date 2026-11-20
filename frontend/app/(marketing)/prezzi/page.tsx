import { Crumbs, CtaBand, FaqList, Hero, Section } from "@/components/site/blocks";
import { Guarantee } from "@/components/site/Guarantee";
import { JsonLd } from "@/components/site/JsonLd";
import { PricingCards } from "@/components/site/PricingCards";
import { PricingTable } from "@/components/site/PricingTable";
import { SITE, absoluteUrl, pageMetadata } from "@/lib/site/config";
import { FAQ } from "@/lib/site/content";
import { fetchPlans } from "@/lib/site/plans";

// Rendered per request (the plans come from the database); the API response itself is cached 60s.
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Prezzi: da gratis a Agency, in euro, mensili o annuali",
  description:
    "Piano Free per sempre senza pubblicità. Piani a pagamento in euro, mensili o annuali, disdici quando vuoi. I tuoi QR non vengono mai disattivati.",
  path: "/prezzi",
});

export default async function PricingPage() {
  const data = await fetchPlans();
  const offers = (data?.plans ?? []).flatMap((p) =>
    Object.entries(p.prices).map(([cycle, price]) => ({
      "@type": "Offer",
      name: `${p.name} (${cycle === "yearly" ? "annuale" : "mensile"})`,
      price: (price!.amount_cents / 100).toFixed(2),
      priceCurrency: price!.currency.toUpperCase(),
      url: absoluteUrl("/prezzi"),
    })),
  );
  const free = data?.plans.find((p) => p.id === "free");
  const allOffers = free
    ? [
        {
          "@type": "Offer",
          name: "Free",
          price: "0",
          priceCurrency: "EUR",
          url: absoluteUrl("/prezzi"),
        },
        ...offers,
      ]
    : offers;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE.name,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          offers: allOffers,
        }}
      />
      <Crumbs items={[{ label: "Prezzi", href: "/prezzi" }]} />
      <Hero
        eyebrow="Prezzi"
        title="Un piano per ogni attività. Gratis, per sempre, se ti basta."
        lead="Prezzi in euro, mese per mese o all’anno, senza vincoli. Niente pubblicità, nemmeno nel piano Free."
        art="pricing"
      />
      <Section>
        {data ? (
          <PricingCards plans={data.plans} labels={data.type_labels} />
        ) : (
          <p role="status">I prezzi non sono al momento disponibili. Riprova tra poco.</p>
        )}
        <p style={{ marginTop: "var(--space-4)", color: "var(--color-text-secondary)" }}>
          Prezzi IVA esclusa, se dovuta. Puoi cambiare piano o disdire in qualsiasi momento.
        </p>
      </Section>
      <Section>
        <Guarantee />
      </Section>
      {data && (
        <Section
          tone="soft"
          title="Confronto completo"
          lead="Tutto ciò che include ogni piano, riga per riga."
        >
          <PricingTable plans={data.plans} />
        </Section>
      )}
      <FaqList items={FAQ.pricing} />
      <CtaBand
        title="Inizia con 14 giorni di prova"
        text="Tutte le funzioni, senza carta di credito. Poi il piano Free per sempre, o quello che scegli."
      />
    </>
  );
}
