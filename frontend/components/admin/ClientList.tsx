"use client";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Select,
  Table,
  fieldStyles,
  type Column,
} from "@/components/ui";
import { NewClientDialog } from "./NewClientDialog";
import { NoResults } from "@/components/illustrations";
import { api, errorMessage } from "@/lib/api";
import { CLIENT_STATE, type ClientRow } from "@/lib/admin-clients";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";
import type { Plan } from "@/lib/types";
import styles from "./admin.module.css";

const columns: Column<ClientRow>[] = [
  {
    key: "name",
    header: "Cliente",
    mobileLabel: false,
    render: (c) => (
      <div className={styles.cellMain}>
        <Link href={`/admin/clients/${c.id}`}>{c.name}</Link>
        <span>
          {c.owner.display_name} · {c.owner.email}
        </span>
      </div>
    ),
  },
  { key: "plan", header: "Piano", render: (c) => c.plan_id.toUpperCase() },
  {
    key: "state",
    header: "Stato",
    render: (c) => (
      <div className={styles.cellMain}>
        <Badge tone={CLIENT_STATE[c.billing_state].tone}>
          {CLIENT_STATE[c.billing_state].label}
        </Badge>
        {c.status === "suspended" && <Badge tone="danger">Sospeso</Badge>}
        {c.invited && !c.deleted_at && <Badge tone="warning">Invitato</Badge>}
        {c.deleted_at && (
          <span>cancellazione dati il {formatDate(c.purge_after ?? c.deleted_at)}</span>
        )}
        {c.grant_until && c.billing_state === "gift" && (
          <span>fino al {formatDate(c.grant_until)}</span>
        )}
      </div>
    ),
  },
  {
    key: "billing",
    header: "Fatturazione",
    render: (c) =>
      c.billing_complete ? (
        <div className={styles.cellMain}>
          <span>{c.legal_name}</span>
          <span>{c.vat ? `P.IVA ${c.vat}` : c.tax_code ? `CF ${c.tax_code}` : ""}</span>
        </div>
      ) : (
        <span className="muted">Da compilare</span>
      ),
  },
  { key: "companies", header: "Aziende", align: "end", render: (c) => c.companies },
  { key: "codes", header: "Codici", align: "end", render: (c) => c.codes },
  { key: "created", header: "Iscritto", align: "end", render: (c) => formatDate(c.created_at) },
];

const STATES = ["trialing", "expired", "active", "past_due", "canceled", "gift", "suspended"];

export function ClientList({ canWrite }: { canWrite: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const [plan, setPlan] = useState("");
  const [state, setState] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Plan[]>("admin/plans").then(setPlans, () => undefined);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams({ search: term, plan, state, archived: String(archived) });
    api<ClientRow[]>(`admin/clients?${query}`)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [term, plan, state, archived]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Clienti</h1>
          <p>Chi usa Vorya QR: piano, stato, dati di fatturazione e aziende collegate.</p>
        </div>
        {canWrite && (
          <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Nuovo cliente
          </Button>
        )}
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">Cerca per nome, email, P.IVA</span>
          <input
            className={fieldStyles.control}
            type="search"
            placeholder="Cerca per nome, email, P.IVA o codice fiscale"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Select label="Piano" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="">Tutti i piani</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Stato" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s === "suspended" ? "Sospesi" : CLIENT_STATE[s as keyof typeof CLIENT_STATE].label}
            </option>
          ))}
        </Select>
        <Select
          label="Elenco"
          value={archived ? "archived" : "active"}
          onChange={(e) => setArchived(e.target.value === "archived")}
        >
          <option value="active">Clienti attivi</option>
          <option value="archived">Eliminati (archivio 30 giorni)</option>
        </Select>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows && rows.length === 0 ? (
        <EmptyState
          illustration={<NoResults />}
          title="Nessun cliente trovato"
          description="Prova a cambiare la ricerca o i filtri."
        />
      ) : (
        <Table columns={columns} rows={rows ?? []} rowKey={(c) => c.id} caption="Clienti" />
      )}
      <NewClientDialog
        open={adding}
        plans={plans}
        onClose={() => setAdding(false)}
        onCreated={(created) => {
          setAdding(false);
          router.push(`/admin/clients/${created.id}`);
        }}
      />
    </div>
  );
}
