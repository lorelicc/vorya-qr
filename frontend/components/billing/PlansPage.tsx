"use client";
import { useCallback, useEffect, useState } from "react";
import { PlanCards } from "@/components/billing/PlanCards";
import { useCheckout } from "@/components/billing/useCheckout";
import { ButtonLink } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { BillingInfo, PublicPlans } from "@/lib/billing";

/** /plans: features and limits straight from each plan; buying needs a customer session. */
export function PlansPage({ loggedIn }: { loggedIn: boolean }) {
  const [plans, setPlans] = useState<PublicPlans | null>(null);
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState("");

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    Promise.all([
      api<PublicPlans>("public/plans"),
      loggedIn ? api<BillingInfo>("account/billing") : Promise.resolve(null),
    ])
      .then(([p, i]) => {
        setPlans(p);
        setInfo(i);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [loggedIn, tick]);
  const { choose, busy, dialogs } = useCheckout(info, load);

  if (error) return <p role="alert">{error}</p>;
  if (!plans)
    return (
      <p className="muted" role="status">
        Caricamento…
      </p>
    );
  return (
    <>
      <PlanCards
        plans={plans.plans}
        labels={plans.type_labels}
        currentPlanId={info?.has_subscription ? info.plan.id : null}
        currentCycle={info?.has_subscription ? info.cycle : null}
        onChoose={loggedIn && plans.online_payments ? choose : undefined}
        busy={busy}
        cta={
          loggedIn && plans.online_payments
            ? undefined
            : () => (
                <ButtonLink href={loggedIn ? "/account/plan" : "/register"}>
                  {loggedIn ? "Vai al tuo piano" : "Prova gratis"}
                </ButtonLink>
              )
        }
      />
      {dialogs}
    </>
  );
}
