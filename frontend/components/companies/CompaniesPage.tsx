"use client";
import { NoCompanies } from "@/components/illustrations";
import { Lock, Plus, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, SkeletonList, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AccountPlan, Company, Transfer } from "@/lib/types";
import { CompanyCard } from "./CompanyCard";
import { CreateCompanyModal } from "./CreateCompanyModal";
import { TransfersPanel } from "./TransfersPanel";
import styles from "./Companies.module.css";

type Transfers = { incoming: Transfer[]; outgoing: Transfer[] };

export function CompaniesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [deleted, setDeleted] = useState<Company[]>([]);
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [transfers, setTransfers] = useState<Transfers>({ incoming: [], outgoing: [] });
  const [creating, setCreating] = useState(params.get("new") === "1");
  const [highlight, setHighlight] = useState<number>();

  const load = useCallback(() => {
    api<Company[]>("companies")
      .then(setCompanies)
      .catch((err) => toast.show(errorMessage(err), "error"));
    api<Company[]>("companies?deleted=true")
      .then(setDeleted)
      .catch(() => setDeleted([]));
    api<AccountPlan>("account/plan")
      .then(setPlan)
      .catch(() => undefined);
    api<Transfers>("company-transfers")
      .then(setTransfers)
      .catch(() => undefined);
  }, [toast]);

  useEffect(() => load(), [load]);

  // Link from the transfer email: /companies#transfer=TOKEN (fragment, never sent to servers).
  useEffect(() => {
    const token = window.location.hash.match(/transfer=([\w-]{43})/)?.[1];
    if (!token) return;
    history.replaceState(null, "", window.location.pathname);
    api<Transfer>("company-transfers/by-token", "POST", { token })
      .then((t) => setHighlight(t.id))
      .catch((err) => toast.show(errorMessage(err), "error"));
  }, [toast]);

  const usage = plan?.usage.companies;
  const locked = usage ? !usage.can_create : false;

  async function remember(id: number) {
    await api("account/last-company", "PUT", { company_id: id }).catch(() => undefined);
  }

  async function restore(company: Company) {
    try {
      await api(`companies/${company.id}/restore`, "POST");
      toast.show(`«${company.name}» ripristinata.`);
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Aziende</h1>
          <p>
            Ogni azienda ha i suoi codici QR, stili, file e statistiche.
            {usage && (
              <span className={styles.counter}>
                {" "}
                {usage.used} di {usage.limit ?? "∞"} aziende
              </span>
            )}
          </p>
        </div>
        <Button
          icon={locked ? <Lock size={16} /> : <Plus size={16} />}
          disabled={locked}
          onClick={() => setCreating(true)}
        >
          Crea azienda
        </Button>
      </div>
      {locked && (
        <p className={styles.locked} role="status">
          <Lock size={16} aria-hidden="true" /> Hai raggiunto il numero di aziende del piano{" "}
          {plan?.plan.name}. Per aggiungerne altre passa a un piano superiore:{" "}
          <a
            href={`mailto:${plan?.support_email}?subject=${encodeURIComponent("Upgrade piano Vorya QR")}`}
          >
            contattaci
          </a>
          .
        </p>
      )}
      <TransfersPanel
        incoming={transfers.incoming}
        outgoing={transfers.outgoing}
        highlight={highlight}
        onChange={load}
      />
      {companies === null ? (
        <SkeletonList rows={3} />
      ) : companies.length === 0 ? (
        <EmptyState
          illustration={<NoCompanies />}
          title="Nessuna azienda"
          description="Crea la tua prima azienda per iniziare a generare codici QR."
          action={<Button onClick={() => setCreating(true)}>Crea azienda</Button>}
        />
      ) : (
        <div className={styles.grid}>
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} onOpen={remember} />
          ))}
        </div>
      )}
      {deleted.length > 0 && (
        <section className={styles.deleted}>
          <h2>Aziende eliminate</h2>
          <ul>
            {deleted.map((company) => (
              <li key={company.id}>
                <span>
                  <strong>{company.name}</strong> recuperabile fino al{" "}
                  {formatDate(company.purge_after!)}
                </span>
                <Button
                  variant="secondary"
                  icon={<RotateCcw size={16} />}
                  onClick={() => restore(company)}
                >
                  Ripristina
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <CreateCompanyModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async (company) => {
          setCreating(false);
          await remember(company.id);
          router.push(`/app/c/${company.id}`);
        }}
      />
    </div>
  );
}
