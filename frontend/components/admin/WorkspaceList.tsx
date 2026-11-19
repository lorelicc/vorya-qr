"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, EmptyState, Table, fieldStyles, type Column } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import type { AdminWorkspace } from "@/lib/types";
import { ACCESS } from "./labels";
import styles from "./admin.module.css";

const columns: Column<AdminWorkspace>[] = [
  {
    key: "name",
    header: "Spazio di lavoro",
    mobileLabel: false,
    render: (ws) => (
      <div className={styles.cellMain}>
        <Link href={`/admin/workspaces/${ws.id}`}>{ws.name}</Link>
        <span>{ws.owner.email}</span>
      </div>
    ),
  },
  { key: "plan", header: "Piano", render: (ws) => ws.plan_id.toUpperCase() },
  {
    key: "access",
    header: "Stato",
    render: (ws) => <Badge tone={ACCESS[ws.access].tone}>{ACCESS[ws.access].label}</Badge>,
  },
  { key: "qr", header: "QR", align: "end", render: (ws) => ws.qr_count ?? 0 },
  { key: "created", header: "Creato", align: "end", render: (ws) => formatDate(ws.created_at) },
];

export function WorkspaceList() {
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const [rows, setRows] = useState<AdminWorkspace[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminWorkspace[]>(`admin/workspaces?search=${encodeURIComponent(term)}`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [term]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Spazi di lavoro</h1>
          <p>Clienti registrati, piano assegnato e stato dell’account.</p>
        </div>
      </div>
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <span className="visually-hidden">Cerca per nome o email</span>
        <input
          className={fieldStyles.control}
          type="search"
          placeholder="Cerca per nome o email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {rows === null ? (
        <p className="muted">Caricamento…</p>
      ) : (
        <Table
          caption="Spazi di lavoro"
          columns={columns}
          rows={rows}
          rowKey={(ws) => ws.id}
          empty={
            <EmptyState
              title="Nessuno spazio di lavoro"
              description="Non ci sono ancora clienti che corrispondono alla ricerca."
            />
          }
        />
      )}
    </div>
  );
}
