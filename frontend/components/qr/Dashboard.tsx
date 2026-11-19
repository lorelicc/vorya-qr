"use client";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { EmptySearch } from "@/components/illustrations";
import { ButtonLink, Card, EmptyState, SkeletonList } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import type { AccountPlan, QrCode } from "@/lib/types";
import { OnboardingPanel } from "./OnboardingPanel";
import { QrCards } from "./QrCards";
import { QrFilters, type Filters } from "./QrFilters";
import { QrTable } from "./QrTable";
import { UsageMeter } from "./UsageMeter";
import { useQrActions } from "./useQrActions";
import styles from "./Dashboard.module.css";

type View = "cards" | "list";
const VIEW_KEY = "vorya-qr:dashboard-view";

function storedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

/** The view lives in localStorage (per browser); "storage" events keep tabs in sync. */
function subscribeView(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_KEY, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_KEY, callback);
  };
}

export function Dashboard() {
  const { api: base, app, company } = useCompany();
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [items, setItems] = useState<QrCode[] | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>({ search: "", kind: "", status: "" });
  const view = useSyncExternalStore(subscribeView, storedView, () => "cards" as View);
  const search = useDebouncedValue(filters.search);
  const actions = useQrActions(
    (qr) => {
      const item = { ...qr, spark: qr.kind === "dynamic" ? [0, 0, 0, 0, 0, 0, 0] : null };
      setItems((all) => (all ? [item, ...all] : [item]));
      api<AccountPlan>("account/plan").then(setPlan, () => undefined);
    },
    (qr) => setItems((all) => all?.map((q) => (q.id === qr.id ? qr : q)) ?? null),
  );

  useEffect(() => {
    api<AccountPlan>("account/plan")
      .then(setPlan)
      .catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(() => {
    const query = new URLSearchParams({ search, kind: filters.kind, status: filters.status });
    api<QrCode[]>(`${base}/qr-codes?${query}`)
      .then(setItems)
      .catch((err) => setError(errorMessage(err)));
  }, [base, search, filters.kind, filters.status]);

  function choose(next: View) {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    window.dispatchEvent(new Event(VIEW_KEY));
  }

  const filtered = Boolean(search || filters.kind || filters.status);
  const canCreate = plan ? plan.usage.static.can_create || plan.usage.dynamic.can_create : true;
  const firstRun = items !== null && items.length === 0 && !filtered;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{company.name}</h1>
          <p>Codici QR dell’azienda: crea, modifica e misura.</p>
        </div>
        {canCreate && !firstRun && (
          <ButtonLink href={`${app}/qr/new`} icon={<Plus size={16} />}>
            Nuovo QR
          </ButtonLink>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {firstRun ? (
        <OnboardingPanel canCreate={canCreate} />
      ) : (
        <>
          {plan && (
            <Card title={`Piano ${plan.plan.name}`} description="Utilizzo del piano">
              <div className={styles.usage}>
                <UsageMeter label="QR dinamici" usage={plan.usage.dynamic} />
                <UsageMeter label="QR statici" usage={plan.usage.static} />
              </div>
            </Card>
          )}
          <div className={styles.toolbar}>
            <QrFilters value={filters} onChange={setFilters} />
            <div className={styles.views} role="radiogroup" aria-label="Vista">
              <button
                type="button"
                role="radio"
                aria-checked={view === "cards"}
                onClick={() => choose("cards")}
                title="Schede"
              >
                <LayoutGrid size={16} aria-hidden="true" />
                <span className="visually-hidden">Schede</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={view === "list"}
                onClick={() => choose("list")}
                title="Elenco"
              >
                <List size={16} aria-hidden="true" />
                <span className="visually-hidden">Elenco</span>
              </button>
            </div>
          </div>
          {items === null ? (
            <SkeletonList rows={4} />
          ) : items.length === 0 ? (
            <EmptyState
              illustration={<EmptySearch />}
              title="Nessun risultato"
              description="Nessun codice QR corrisponde ai filtri selezionati."
            />
          ) : view === "cards" ? (
            <QrCards rows={items} base={app} actions={actions} />
          ) : (
            <QrTable rows={items} base={app} actions={actions} />
          )}
        </>
      )}
    </div>
  );
}
