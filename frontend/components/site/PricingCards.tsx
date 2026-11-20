"use client";
import { PlanCards } from "@/components/billing/PlanCards";
import { ButtonLink } from "@/components/ui";
import type { PublicPlans } from "@/lib/billing";

/** Plan cards for the public site: every plan leads to the free signup (no price in code). */
export function PricingCards({
  plans,
  labels,
}: {
  plans: PublicPlans["plans"];
  labels: Record<string, string>;
}) {
  return (
    <PlanCards
      plans={plans}
      labels={labels}
      cta={(plan) =>
        plan.id !== "free" && !plan.prices.monthly && !plan.prices.yearly ? (
          <ButtonLink href="/contatti" variant="secondary">
            Contattaci
          </ButtonLink>
        ) : (
          <ButtonLink href="/register" data-umami-event={`prezzi-${plan.id}`}>
            {plan.id === "free" ? "Inizia gratis" : "Prova 14 giorni gratis"}
          </ButtonLink>
        )
      }
    />
  );
}
