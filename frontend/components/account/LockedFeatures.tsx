import { Lock } from "lucide-react";
import { Locked } from "@/components/illustrations";
import { Card } from "@/components/ui";
import type { AccountPlan } from "@/lib/types";
import styles from "./PlanOverview.module.css";

/** What the current plan does not include, shown with a lock instead of being hidden. */
export function LockedFeatures({ plan }: { plan: AccountPlan }) {
  const f = plan.features;
  const missingTypes = Object.keys(plan.type_labels).filter((t) => !f.allowed_types.includes(t));
  const next = plan.plan.id === "pro" ? "Plus" : "Pro";
  const items = [
    ...missingTypes.map((t) => [`QR «${plan.type_labels[t]}»`, "Pro"]),
    ...(f.remove_branding ? [] : [["Pagine senza “Creato con Vorya QR”", "Pro"]]),
    ...(f.stats_retention_days === null
      ? []
      : [[`Statistiche oltre ${f.stats_retention_days} giorni`, next]]),
  ];
  if (items.length === 0) return null;
  return (
    <Card title="Non incluso nel tuo piano">
      <div className={styles.locked}>
        <Locked />
        <ul>
          {items.map(([item, tier]) => (
            <li key={item}>
              <Lock size={14} aria-hidden="true" /> {item}: disponibile nel piano {tier}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
