"use client";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { ButtonLink } from "@/components/ui";
import { formatMoney, type Cycle, type PlanCardData } from "@/lib/billing";
import type { SiteOffer } from "@/lib/site/offer";
import styles from "./pricing-grid.module.css";

const n = (value: number | null, one: string, many: string, all = "illimitati") =>
  value === null ? `${many} ${all}` : `${value} ${value === 1 ? one : many}`;

/** The lines of a card, straight from the plan's limits and features (nothing typed by hand). */
function lines(plan: PlanCardData): string[] {
  const f = plan.features;
  const out = [
    n(plan.limits.companies, "azienda", "aziende", "illimitate"),
    `${n(plan.limits.dynamic_qr, "QR dinamico", "QR dinamici")}${plan.limits.companies === 1 ? "" : " per azienda"}`,
    plan.limits.static_qr === null
      ? "QR statici illimitati"
      : n(plan.limits.static_qr, "QR statico", "QR statici"),
    f.stats_retention_days == null
      ? "Statistiche senza limiti"
      : `Statistiche ${f.stats_retention_days} giorni`,
  ];
  if (f.menu_type) out.push("Menu e carta dei vini");
  if (f.custom_back_half) out.push("Back-half personalizzati");
  if (f.link_rules) out.push("Scadenza, password, programmazione");
  if (f.max_bulk_rows > 0) out.push(`Importa da CSV (${f.max_bulk_rows} righe)`);
  if ((f.report_frequencies?.length ?? 0) > 0) out.push("Report via email");
  if (f.remove_branding) out.push("Senza «Creato con Vorya QR»");
  return out;
}

/**
 * Pricing cards. Everything shown (limits, prices) comes from the plans table; the highlighted
 * plan, its label, the yearly discount label and the trial length come from the admin settings.
 */
export function PricingGrid({ plans, offer }: { plans: PlanCardData[]; offer: SiteOffer | null }) {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const hasYearly = plans.some((p) => p.prices.yearly);
  const days = offer?.trial.days ?? 0;
  return (
    <div>
      {hasYearly && (
        <div className={styles.toggleWrap}>
          <div className={styles.toggle} role="radiogroup" aria-label="Ciclo di fatturazione">
            {(["monthly", "yearly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={cycle === value}
                onClick={() => setCycle(value)}
              >
                {value === "monthly" ? "Mensile" : "Annuale"}
              </button>
            ))}
            <i className={styles.thumb} data-pos={cycle} aria-hidden="true" />
          </div>
          {offer?.yearly_label && (
            <span className={styles.saving} data-on={cycle === "yearly"}>
              <Sparkles size={14} aria-hidden="true" /> {offer.yearly_label}
            </span>
          )}
        </div>
      )}
      <div className={styles.grid}>
        {plans.map((plan) => {
          const price = plan.prices[cycle];
          const monthlyEq =
            price && cycle === "yearly" ? Math.round(price.amount_cents / 12) : price?.amount_cents;
          const featured = offer?.featured_plan === plan.id;
          const free = plan.id === "free";
          return (
            <section
              key={plan.id}
              className={styles.card}
              data-featured={featured || undefined}
              aria-label={`Piano ${plan.name}`}
            >
              {featured && <span className={styles.ribbon}>{offer?.featured_label}</span>}
              <h3>{plan.name}</h3>
              <p className={styles.desc}>{plan.description}</p>
              <div className={styles.price}>
                {free ? (
                  <>
                    <b>Gratis</b>
                    <small>per sempre</small>
                  </>
                ) : price ? (
                  <>
                    <b>{formatMoney(monthlyEq ?? 0, price.currency)}</b>
                    <small>/ mese</small>
                  </>
                ) : (
                  <b className={styles.ask}>Su richiesta</b>
                )}
              </div>
              <p className={styles.billing}>
                {free
                  ? "Senza carta di credito"
                  : price
                    ? cycle === "yearly"
                      ? `${formatMoney(price.amount_cents, price.currency)} fatturati all’anno · IVA esclusa`
                      : "Fatturati ogni mese · IVA esclusa"
                    : " "}
              </p>
              {!free && !price ? (
                <ButtonLink href="/contatti" variant="secondary" block>
                  Contattaci
                </ButtonLink>
              ) : (
                <ButtonLink
                  href="/register"
                  variant={featured ? "primary" : "secondary"}
                  block
                  data-umami-event={`prezzi-${plan.id}`}
                >
                  {free || days === 0 ? "Inizia gratis" : `Prova ${days} giorni gratis`}
                </ButtonLink>
              )}
              <ul>
                {lines(plan).map((line) => (
                  <li key={line}>
                    <Check size={16} aria-hidden="true" /> {line}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
