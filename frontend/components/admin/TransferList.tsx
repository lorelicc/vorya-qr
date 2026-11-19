"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, EmptyState, Table, type BadgeTone, type Column } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AdminTransfer } from "@/lib/types";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "In attesa", tone: "info" },
  accepted: { label: "Accettato", tone: "success" },
  declined: { label: "Rifiutato", tone: "neutral" },
  cancelled: { label: "Annullato", tone: "neutral" },
  expired: { label: "Scaduto", tone: "warning" },
  failed: { label: "Non riuscito", tone: "danger" },
};

const workspace = (w: { id: number | null; name: string | null }) =>
  w.id ? <Link href={`/admin/clients/${w.id}`}>{w.name ?? `#${w.id}`}</Link> : "—";

const columns: Column<AdminTransfer>[] = [
  {
    key: "company",
    header: "Azienda",
    mobileLabel: false,
    render: (t) => <strong>{t.company}</strong>,
  },
  { key: "from", header: "Da", render: (t) => workspace(t.from_workspace) },
  {
    key: "to",
    header: "A",
    render: (t) => (t.to_workspace.id ? workspace(t.to_workspace) : t.to_email),
  },
  {
    key: "status",
    header: "Stato",
    render: (t) => {
      const s = STATUS[t.status] ?? { label: t.status, tone: "neutral" as const };
      return (
        <span title={t.failure_reason ?? undefined}>
          <Badge tone={s.tone}>{s.label}</Badge>
        </span>
      );
    },
  },
  { key: "date", header: "Creato", align: "end", render: (t) => formatDateTime(t.created_at) },
];

export function TransferList() {
  const [rows, setRows] = useState<AdminTransfer[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<AdminTransfer[]>("admin/company-transfers")
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, []);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Trasferimenti</h1>
          <p>Passaggi di aziende tra account. Solo consultazione: li decidono i clienti.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows === null ? (
        <p className="muted">Caricamento…</p>
      ) : (
        <Table
          caption="Trasferimenti di aziende"
          columns={columns}
          rows={rows}
          rowKey={(t) => t.id}
          empty={
            <EmptyState
              title="Nessun trasferimento"
              description="Non ci sono ancora trasferimenti."
            />
          }
        />
      )}
    </div>
  );
}
