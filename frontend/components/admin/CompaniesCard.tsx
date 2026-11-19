"use client";
import { Card } from "@/components/ui";
import type { ClientDetailData } from "@/lib/admin-clients";
import { formatDate } from "@/lib/format";
import styles from "./admin.module.css";

/** The companies (brands) that live inside a customer's account. */
export function CompaniesCard({ companies }: { companies: ClientDetailData["companies"] }) {
  return (
    <Card title={`Aziende collegate (${companies.length})`}>
      <div className={styles.companyGrid}>
        {companies.map((c) => (
          <div
            key={c.id}
            className={styles.companyCard}
            data-deleted={c.status !== "active" || undefined}
          >
            <strong>{c.name}</strong>
            <span>
              {c.codes} {c.codes === 1 ? "codice" : "codici"}
              {c.sector && ` · ${c.sector}`}
            </span>
            <span>
              {c.status === "active" ? `Creata il ${formatDate(c.created_at)}` : "Eliminata"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
