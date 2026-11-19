"use client";
import { Plus, QrCode as QrIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink, Card, EmptyState } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import type { AccountPlan, QrCode } from "@/lib/types";
import { QrFilters, type Filters } from "./QrFilters";
import { QrTable } from "./QrTable";
import { UsageMeter } from "./UsageMeter";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [items, setItems] = useState<QrCode[] | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>({ search: "", kind: "", status: "" });
  const search = useDebouncedValue(filters.search);

  useEffect(() => {
    api<AccountPlan>("account/plan")
      .then(setPlan)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ search, kind: filters.kind, status: filters.status });
    api<QrCode[]>(`qr-codes?${query}`)
      .then(setItems)
      .catch((err) => setError(errorMessage(err)));
  }, [search, filters.kind, filters.status]);

  const filtered = Boolean(search || filters.kind || filters.status);
  const canCreate = plan ? plan.usage.static.can_create || plan.usage.dynamic.can_create : true;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Codici QR</h1>
          <p>Crea, modifica e misura i tuoi codici QR.</p>
        </div>
        {canCreate && (
          <ButtonLink href="/app/qr/new" icon={<Plus size={16} />}>
            Nuovo QR
          </ButtonLink>
        )}
      </div>
      {plan && (
        <Card title={`Piano ${plan.plan.name}`} description="Utilizzo del piano">
          <div className={styles.usage}>
            <UsageMeter label="QR dinamici" usage={plan.usage.dynamic} />
            <UsageMeter label="QR statici" usage={plan.usage.static} />
          </div>
        </Card>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <QrFilters value={filters} onChange={setFilters} />
      {items === null ? (
        <p className="muted" role="status">
          Caricamento…
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<QrIcon size={26} />}
          title={filtered ? "Nessun risultato" : "Crea il tuo primo codice QR"}
          description={
            filtered
              ? "Nessun codice QR corrisponde ai filtri selezionati."
              : "I QR dinamici puntano a un link breve: puoi cambiare la destinazione quando vuoi e vedere le scansioni."
          }
          action={
            !filtered && canCreate ? (
              <ButtonLink href="/app/qr/new">Nuovo QR</ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <QrTable rows={items} />
      )}
    </div>
  );
}
