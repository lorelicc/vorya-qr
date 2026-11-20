import { Crumbs, CtaBand, FaqList, Hero, Section } from "@/components/site/blocks";
import { JsonLd } from "@/components/site/JsonLd";
import { PricingGrid } from "@/components/site/PricingGrid";
import { PricingTable } from "@/components/site/PricingTable";
import { SITE, absoluteUrl, pageMetadata } from "@/lib/site/config";
import { FAQ } from "@/lib/site/content";
import { PlanScene, PricingScene } from "@/components/site/scenes";
import { fetchOffer } from "@/lib/site/offer";
import { fetchPlans } from "@/lib/site/plans";
import styles from "@/components/site/home.module.css";

// Rendered per request: plans and offer come from the database and are never cached.
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Prezzi: da gratis a Agency, in euro, mensili o annuali",
  description:
    "Piano Free per sempre senza pubblicità. Piani a pagamento in euro, mensili o annuali, disdici quando vuoi. Se smetti di pagare restano attivi i 2 QR dinamici del Free.",
  path: "/prezzi",
});

export default async function PricingPage() {
  const [data, offer] = await Promise.all([fetchPlans(), fetchOffer()]);
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
      <Crumbs tone="dark" items={[{ label: "Prezzi", href: "/prezzi" }]} />
      <Hero
        eyebrow="Prezzi"
        tone="dark"
        title="Un piano per ogni attività. Gratis, per sempre, se ti basta."
        lead="Prezzi in euro, mese per mese o all’anno, senza vincoli. Niente pubblicità, nemmeno nel piano Free."
        scene={<PricingScene />}
      />
      <Section tone="mint">
        <h2 className="visually-hidden">Confronta i piani</h2>
        {data ? (
          <PricingGrid plans={data.plans} offer={offer} />
        ) : (
          <p role="status">I prezzi non sono al momento disponibili. Riprova tra poco.</p>
        )}
        <p style={{ marginTop: "var(--space-6)", textAlign: "center" }}>
          Prezzi IVA esclusa, se dovuta. Puoi cambiare piano o disdire in qualsiasi momento.
        </p>
      </Section>
      <Section tone="forest">
        <div className={styles.split}>
          <div className={styles.splitCopy}>
            <p className={`${styles.kicker} ${styles.kickerLight}`}>Trasparenza</p>
            <h2>Cosa succede se smetti di pagare</h2>
            <p>
              Lo diciamo prima, non dopo la stampa: passi al piano Free, restano attivi i 2 QR
              dinamici più vecchi e tutti i QR statici. Gli altri vengono sospesi («QR non attivo»)
              e si riattivano appena torni a un piano o ne elimini altri. Non cancelliamo nulla.
            </p>
          </div>
          <PlanScene />
        </div>
      </Section>
      {data && (
        <Section title="Confronto completo" lead="Tutto ciò che include ogni piano, riga per riga.">
          <PricingTable plans={data.plans} />
        </Section>
      )}
      <FaqList items={FAQ.pricing} tone="lilac" />
      <CtaBand
        title={
          offer && offer.trial.days > 0
            ? `Inizia con ${offer.trial.days} giorni di prova`
            : "Inizia gratis"
        }
        text="Senza carta di credito. Poi il piano Free per sempre, o quello che scegli."
      />
    </>
  );
}
