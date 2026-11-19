"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { PlanEditor } from "./PlanEditor";
import styles from "./admin.module.css";

export function PlanList({ canWrite }: { canWrite: boolean }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Plan[]>("admin/plans")
      .then(setPlans)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Piani</h1>
          <p>
            Limiti e funzioni provvisori della 0.2. Ridurre un limite non disattiva i QR esistenti:
            blocca solo le nuove creazioni.
          </p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.plans}>
        {plans?.map((plan) => (
          <PlanEditor
            key={plan.id}
            plan={plan}
            canWrite={canWrite}
            onSaved={(saved) =>
              setPlans((all) => all?.map((p) => (p.id === saved.id ? saved : p)) ?? null)
            }
          />
        ))}
      </div>
    </div>
  );
}
