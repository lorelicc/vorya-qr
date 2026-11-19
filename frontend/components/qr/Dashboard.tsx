"use client";
import { Folder, LayoutGrid, List, Plus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { EmptySearch, NoResults } from "@/components/illustrations";
import { Button, ButtonLink, Card, EmptyState, SkeletonList, useToast } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import type { AccountPlan, QrCode } from "@/lib/types";
import { OnboardingPanel } from "./OnboardingPanel";
import { QrCards } from "./QrCards";
import { QuickLinkBar } from "@/components/links/QuickLinkBar";
import { DashboardDnd } from "@/components/organize/DashboardDnd";
import { FolderPicker } from "@/components/organize/FolderPicker";
import { FolderTree } from "@/components/organize/FolderTree";
import { MoreFilters } from "@/components/organize/MoreFilters";
import { SelectionBar } from "@/components/organize/SelectionBar";
import { SelectionContext } from "@/components/organize/SelectionContext";
import { TagsBar } from "@/components/organize/TagsBar";
import { useOrganize } from "@/components/organize/useOrganize";
import organize from "@/components/organize/organize.module.css";
import {
  DEFAULT_FILTERS,
  QrFilters,
  ViewTabs,
  filtersQuery,
  isFiltered,
  type Filters,
} from "./QrFilters";
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
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const org = useOrganize();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [movingOne, setMovingOne] = useState<QrCode | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [refresh, setRefresh] = useState(0);
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
  const query = filtersQuery(filters, search);
  useEffect(() => {
    api<QrCode[]>(`${base}/qr-codes?${query}`)
      .then(setItems)
      .catch((err) => setError(errorMessage(err)));
  }, [base, query, refresh]);

  const reload = () => {
    setRefresh((n) => n + 1);
    org.reload();
  };

  async function moveLinks(ids: number[], folderId: number | null) {
    try {
      await api(`${base}/qr-codes/bulk`, "POST", { ids, action: "move", folder_id: folderId });
      toast.show(ids.length > 1 ? `${ids.length} elementi spostati.` : "Elemento spostato.");
      setSelected(new Set());
      reload();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function moveFolder(id: number, parent: number | null) {
    try {
      await org.moveFolder(id, parent);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const toggle = (id: number) =>
    setSelected((all) => {
      const next = new Set(all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function choose(next: View) {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    window.dispatchEvent(new Event(VIEW_KEY));
  }

  const filtered = isFiltered(filters, search);
  const canCreate = plan ? plan.usage.static.can_create || plan.usage.dynamic.can_create : true;
  const firstRun = items !== null && items.length === 0 && !filtered;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{company.name}</h1>
          <p>Link brevi e codici QR dell’azienda: crea, modifica e misura.</p>
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
      {/* One stable instance: it must not remount when the list finishes loading. */}
      <QuickLinkBar onCreated={(link) => setItems((all) => (all ? [link, ...all] : [link]))} />
      {firstRun ? (
        <OnboardingPanel canCreate={canCreate} />
      ) : (
        <SelectionContext.Provider
          value={{ selected, toggle, tags: org.tags, onMove: setMovingOne }}
        >
          <DashboardDnd
            items={items ?? []}
            selected={selected}
            folderName={(id) => org.folders.find((f) => f.id === id)?.name ?? "Cartella"}
            onDropLinks={moveLinks}
            onDropFolder={moveFolder}
          >
            {plan && (
              <Card title={`Piano ${plan.plan.name}`} description="Utilizzo del piano">
                <div className={styles.usage}>
                  <UsageMeter label="QR dinamici" usage={plan.usage.dynamic} />
                  <UsageMeter label="QR statici" usage={plan.usage.static} />
                </div>
              </Card>
            )}
            <div className={organize.layout}>
              <div>
                <Button
                  variant="secondary"
                  className={organize.mobileToggle}
                  icon={<Folder size={16} />}
                  aria-expanded={showFolders}
                  onClick={() => setShowFolders((v) => !v)}
                >
                  Cartelle
                </Button>
                <div data-collapsed={showFolders ? undefined : ""} className={organize.treeWrap}>
                  <FolderTree
                    org={org}
                    value={filters.folder}
                    total={org.unfiled + org.folders.reduce((n, f) => n + f.link_count, 0)}
                    onChange={(folder) => setFilters({ ...filters, folder })}
                  />
                </div>
              </div>
              <div className={organize.mainColumn}>
                <ViewTabs value={filters} onChange={setFilters} />
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
                <TagsBar
                  org={org}
                  selected={filters.tagIds}
                  onChange={(tagIds) => setFilters({ ...filters, tagIds })}
                />
                <MoreFilters value={filters} onChange={setFilters} />
                {items === null ? (
                  <SkeletonList rows={4} />
                ) : items.length === 0 ? (
                  <EmptyState
                    illustration={filtered ? <NoResults /> : <EmptySearch />}
                    title={filtered ? "Nessun risultato con questi filtri" : "Nessun elemento qui"}
                    description={
                      filtered
                        ? "Prova a togliere qualche filtro."
                        : "Trascina qui link e QR, oppure usa «Sposta in…»."
                    }
                    action={
                      filtered ? (
                        <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                          Azzera i filtri
                        </Button>
                      ) : undefined
                    }
                  />
                ) : view === "cards" ? (
                  <QrCards rows={items} base={app} actions={actions} />
                ) : (
                  <QrTable rows={items} base={app} actions={actions} />
                )}
              </div>
            </div>
          </DashboardDnd>
          <SelectionBar
            selected={selected}
            items={items ?? []}
            org={org}
            onClear={() => setSelected(new Set())}
            onDone={() => {
              setSelected(new Set());
              reload();
            }}
          />
          <FolderPicker
            open={movingOne !== null}
            title={`Sposta «${movingOne?.name ?? ""}» in…`}
            folders={org.folders}
            onClose={() => setMovingOne(null)}
            onPick={async (folderId) => {
              if (movingOne) await moveLinks([movingOne.id], folderId);
              setMovingOne(null);
            }}
          />
        </SelectionContext.Provider>
      )}
    </div>
  );
}
