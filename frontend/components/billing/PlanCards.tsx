"use client";
import { useState, type ReactNode } from "react";
import { Badge, Button } from "@/components/ui";
import {
  CYCLE_LABEL,
  featureLines,
  formatMoney,
  yearlySaving,
  type Cycle,
  type PlanCardData,
} from "@/lib/billing";
import styles from "./billing.module.css";

type Props = {
  plans: PlanCardData[];
  labels: Record<string, string>;
  currentPlanId?: string | null;
  currentCycle?: Cycle | null;
  /** Called with the chosen plan and billing cycle; absent => cards are read-only. */
  onChoose?: (plan: PlanCardData, cycle: Cycle) => void;
  busy?: string | null;
  cta?: (plan: PlanCardData, cycle: Cycle) => ReactNode;
};

/** Plan comparison. Prices come from the admin-managed table: a plan without one is not for sale. */
export function PlanCards({
  plans,
  labels,
  currentPlanId,
  currentCycle,
  onChoose,
  busy,
  cta,
}: Props) {
  const [cycle, setCycle] = useState<Cycle>(currentCycle ?? "monthly");
  const hasYearly = plans.some((p) => p.prices.yearly);
  const saving = Math.max(0, ...plans.map((p) => yearlySaving(p.prices)));
  return (
    <div>
      {hasYearly && (
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
              {value === "yearly" && saving > 0 && <span className={styles.save}>−{saving}%</span>}
            </button>
          ))}
        </div>
      )}
      <div className={styles.grid}>
        {plans.map((plan) => {
          const price = plan.prices[cycle];
          const current = plan.id === currentPlanId && (!currentCycle || currentCycle === cycle);
          return (
            <section
              key={plan.id}
              className={styles.plan}
              data-current={plan.id === currentPlanId}
              aria-label={`Piano ${plan.name}`}
            >
              <div>
                <h3>
                  {plan.name}{" "}
                  {plan.id === currentPlanId && <Badge tone="success">Il tuo piano</Badge>}
                </h3>
                {plan.description && <p>{plan.description}</p>}
              </div>
              <div className={styles.price}>
                {plan.id === "free" ? (
                  <>
                    Gratis <small>per sempre</small>
                  </>
                ) : price ? (
                  <>
                    {formatMoney(price.amount_cents, price.currency)}{" "}
                    <small>/ {CYCLE_LABEL[cycle]} + IVA se dovuta</small>
                  </>
                ) : (
                  <small>Prezzo su richiesta</small>
                )}
              </div>
              <ul className={styles.features}>
                {featureLines(plan, labels).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {cta
                ? cta(plan, cycle)
                : onChoose && (
                    <Button
                      variant={current ? "secondary" : "primary"}
                      disabled={!price || current}
                      loading={busy === plan.id}
                      onClick={() => onChoose(plan, cycle)}
                    >
                      {current ? "Piano attuale" : "Scegli " + plan.name}
                    </Button>
                  )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
