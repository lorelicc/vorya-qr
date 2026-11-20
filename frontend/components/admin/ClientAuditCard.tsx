"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import { AUDIT_LABEL, type AuditEntry } from "@/lib/admin-clients";
import { formatDate } from "@/lib/format";
import styles from "./admin.module.css";

/** Who did what to this customer, newest first. */
export function ClientAuditCard({ clientId, refresh }: { clientId: number; refresh: number }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  useEffect(() => {
    api<AuditEntry[]>(`admin/clients/${clientId}/audit`).then(setRows, () => setRows([]));
  }, [clientId, refresh]);
  return (
    <Card title="Cronologia" description="Le azioni fatte su questo cliente.">
      {rows && rows.length === 0 ? (
        <p className="muted">Ancora nessuna azione registrata.</p>
      ) : (
        <ul className={styles.timeline}>
          {(rows ?? []).map((a) => (
            <li key={a.id}>
              <strong>{AUDIT_LABEL[a.action] ?? a.action}</strong>
              <span>
                {formatDate(a.created_at)} · {a.actor ?? "sistema o cliente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
