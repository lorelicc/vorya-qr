"use client";
import { Button, Card, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { ClientDetailData } from "@/lib/admin-clients";
import { formatDate } from "@/lib/format";
import styles from "./admin.module.css";

/** The companies (brands) that live inside a customer's account. */
export function CompaniesCard({
  clientId,
  companies,
  canWrite,
  archived,
  onChanged,
}: {
  clientId: number;
  companies: ClientDetailData["companies"];
  canWrite: boolean;
  archived: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  async function act(id: number, action: "delete" | "restore") {
    try {
      await api(`admin/clients/${clientId}/companies/${id}/${action}`, "POST");
      toast.show(
        action === "delete"
          ? "Azienda eliminata (recuperabile per 30 giorni)."
          : "Azienda ripristinata.",
      );
      onChanged();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }
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
            {canWrite && !archived && c.status !== "purged" && (
              <Button
                variant={c.status === "active" ? "danger" : "secondary"}
                onClick={() => act(c.id, c.status === "active" ? "delete" : "restore")}
              >
                {c.status === "active" ? "Elimina" : "Ripristina"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
