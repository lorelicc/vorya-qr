"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney, type PublicPlans } from "@/lib/billing";
import styles from "./pricing.module.css";

/** Home price preview: read in the browser from the same table as /prezzi (no price in code). */
export function PlansPreview() {
  const [data, setData] = useState<PublicPlans | null>(null);
  useEffect(() => {
    fetch("/api/public/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData, () => setData(null));
  }, []);
  if (!data)
    return (
      <p className="muted" role="status">
        <Link href="/prezzi">Vedi tutti i piani e i prezzi</Link>
      </p>
    );
  return (
    <div className={styles.previewGrid}>
      {data.plans.map((p) => {
        const price = p.prices.monthly;
        return (
          <Link key={p.id} href="/prezzi" className={styles.previewCard}>
            <strong>{p.name}</strong>
            <span>
              {p.id === "free"
                ? "Gratis per sempre"
                : price
                  ? `da ${formatMoney(price.amount_cents, price.currency)} / mese`
                  : "—"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
