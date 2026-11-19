"use client";
import { useEffect, useState } from "react";
import { UsageMeter } from "@/components/qr/UsageMeter";
import { ButtonLink, Card } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { daysLeft, formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/upload";
import type { AccountPlan } from "@/lib/types";
import styles from "./PlanOverview.module.css";

export function PlanOverview() {
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AccountPlan>("account/plan")
      .then(setPlan)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!plan)
    return (
      <p className="muted" role="status">
        Caricamento…
      </p>
    );

  const trial = plan.access === "trial" && plan.trial_ends_at;
  const mail = `mailto:${plan.support_email}?subject=${encodeURIComponent("Piano Vorya QR")}`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Piano e utilizzo</h1>
          <p>Il piano viene attivato dal nostro team: scrivici per cambiarlo.</p>
        </div>
        <ButtonLink href={mail} variant="secondary">
          Contattaci
        </ButtonLink>
      </div>
      <Card title={`Piano ${plan.plan.name}`} description={plan.plan.description}>
        {trial && (
          <p className={styles.trial}>
            Prova gratuita: {daysLeft(plan.trial_ends_at)} giorni rimasti (fino al{" "}
            {formatDate(plan.trial_ends_at!)}). Durante la prova hai i limiti del piano Pro.
          </p>
        )}
        <div className={styles.meters}>
          <UsageMeter label="QR dinamici" usage={plan.usage.dynamic} />
          <UsageMeter label="QR statici" usage={plan.usage.static} />
          <UsageMeter label="Aziende" usage={plan.usage.companies} />
          <UsageMeter label="Spazio file" usage={plan.usage.storage} format={formatBytes} />
        </div>
      </Card>
    </div>
  );
}
