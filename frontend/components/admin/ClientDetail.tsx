"use client";
import { ArrowLeft, Gift } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UsageMeter } from "@/components/qr/UsageMeter";
import { Badge, Button, Card, Modal, Select, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { CLIENT_STATE, type ClientDetailData } from "@/lib/admin-clients";
import { formatMoney } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import type { Plan } from "@/lib/types";
import { CompaniesCard } from "./CompaniesCard";
import { GrantDialog } from "./GrantDialog";
import { GrantHistory } from "./GrantHistory";
import styles from "./admin.module.css";

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </>
);

export function ClientDetail({ id, canWrite }: { id: number; canWrite: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<ClientDetailData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [giving, setGiving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    Promise.all([api<ClientDetailData>(`admin/clients/${id}`), api<Plan[]>("admin/plans")])
      .then(([detail, list]) => {
        setData(detail);
        setPlanId(detail.plan_id);
        setPlans(list);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id, tick]);

  async function act(
    path: string,
    body?: unknown,
    ok = "Salvato.",
    method: "POST" | "PUT" = "POST",
  ) {
    setBusy(true);
    try {
      await api(path, method, body);
      toast.show(ok);
      setTick((n) => n + 1);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
      setSuspending(false);
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p className="muted">Caricamento…</p>;
  const state = CLIENT_STATE[data.billing_state];
  const suspended = data.status === "suspended";
  const p = data.profile;
  const activeGrant = data.grants.find((g) => !g.revoked_at && new Date(g.ends_at) > new Date());

  return (
    <div className="page">
      <Link href="/admin/clients" className={styles.back}>
        <ArrowLeft size={16} /> Clienti
      </Link>
      <div className="page-header">
        <div>
          <h1>{data.name}</h1>
          <p>
            {data.owner.display_name} · {data.owner.email} · iscritto il{" "}
            {formatDate(data.created_at)}
            {data.owner.last_login_at &&
              ` · ultimo accesso ${formatDate(data.owner.last_login_at)}`}
          </p>
        </div>
        <div>
          <Badge tone={state.tone}>{state.label}</Badge>{" "}
          {suspended && <Badge tone="danger">Sospeso</Badge>}
        </div>
      </div>

      <div className="grid-2">
        <Card
          title="Dati di fatturazione"
          description="Quelli che il cliente ha inserito prima di pagare."
        >
          {p ? (
            <dl className={styles.facts}>
              <Fact label="Intestatario">{p.legal_name}</Fact>
              {p.vat && <Fact label="Partita IVA">{p.vat}</Fact>}
              {p.tax_code && <Fact label="Codice fiscale">{p.tax_code}</Fact>}
              <Fact label="Indirizzo">
                {p.address}, {p.zip} {p.city} {p.province && `(${p.province})`} · {p.country}
              </Fact>
              {p.sdi_code && <Fact label="Codice SDI">{p.sdi_code}</Fact>}
              {p.pec && <Fact label="PEC">{p.pec}</Fact>}
            </dl>
          ) : (
            <p className="muted">Il cliente non ha ancora inserito i dati di fatturazione.</p>
          )}
        </Card>

        <Card title="Piano e abbonamento">
          <div className="stack">
            <dl className={styles.facts}>
              <Fact label="Piano">{data.plan_id.toUpperCase()}</Fact>
              {data.trial_ends_at && (
                <Fact label="Prova fino al">{formatDate(data.trial_ends_at)}</Fact>
              )}
              {data.subscription?.subscription_id && (
                <>
                  <Fact label="Ciclo">
                    {data.subscription.cycle === "yearly" ? "Annuale" : "Mensile"}
                  </Fact>
                  {data.subscription.period_end && (
                    <Fact label={data.subscription.cancel_at_period_end ? "Termina il" : "Rinnovo"}>
                      {formatDate(data.subscription.period_end)}
                    </Fact>
                  )}
                  <Fact label="Stripe">
                    <code>{data.subscription.customer_id}</code>
                  </Fact>
                </>
              )}
            </dl>
            {data.usage.dynamic && <UsageMeter label="QR dinamici" usage={data.usage.dynamic} />}
            {data.usage.companies && <UsageMeter label="Aziende" usage={data.usage.companies} />}
            {canWrite && (
              <>
                <Select
                  label="Cambia piano (manuale)"
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </Select>
                <div>
                  <Button
                    variant="secondary"
                    loading={busy}
                    disabled={planId === data.plan_id}
                    onClick={() =>
                      act(
                        `admin/workspaces/${id}/plan`,
                        { plan_id: planId },
                        "Piano assegnato.",
                        "PUT",
                      )
                    }
                  >
                    Assegna piano
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Omaggi"
        description="Regala un piano o dei mesi: nessun addebito, il cliente riceve una email."
      >
        <div className="stack">
          {activeGrant && (
            <p role="status">
              Omaggio in corso: piano <strong>{activeGrant.plan_id.toUpperCase()}</strong> fino al{" "}
              {formatDate(activeGrant.ends_at)}.
            </p>
          )}
          {canWrite && (
            <div>
              <Button icon={<Gift size={16} />} onClick={() => setGiving(true)}>
                Regala un piano
              </Button>
            </div>
          )}
          <GrantHistory
            grants={data.grants}
            canWrite={canWrite}
            onRevoke={(gid) =>
              act(`admin/clients/${id}/grants/${gid}/revoke`, undefined, "Omaggio revocato.")
            }
          />
        </div>
      </Card>

      <CompaniesCard companies={data.companies} />

      {data.payments.length > 0 && (
        <Card title="Ultimi pagamenti">
          <dl className={styles.facts}>
            {data.payments.map((pay) => (
              <Fact key={pay.id} label={pay.paid_at ? formatDate(pay.paid_at) : "—"}>
                {formatMoney(pay.amount_cents, pay.currency)}{" "}
                <Badge tone={pay.status === "paid" ? "success" : "danger"}>
                  {pay.status === "paid" ? "Pagato" : "Non riuscito"}
                </Badge>
              </Fact>
            ))}
          </dl>
        </Card>
      )}

      <Card
        title="Sospensione"
        description="Un account sospeso non può accedere e i suoi QR mostrano “QR non attivo”."
      >
        {canWrite ? (
          <Button
            variant={suspended ? "primary" : "danger"}
            loading={busy}
            onClick={() =>
              suspended
                ? act(`admin/workspaces/${id}/reactivate`, undefined, "Account riattivato.")
                : setSuspending(true)
            }
          >
            {suspended ? "Riattiva account" : "Sospendi account"}
          </Button>
        ) : (
          <p className="muted">Solo un Super Admin può modificare lo stato.</p>
        )}
      </Card>

      <GrantDialog
        open={giving}
        clientId={id}
        plans={plans}
        defaultPlan={plans.find((x) => x.id === "pro")?.id ?? data.plan_id}
        onClose={() => setGiving(false)}
        onDone={(detail) => {
          setGiving(false);
          setData(detail);
        }}
      />
      <Modal
        open={suspending}
        title="Sospendere l’account?"
        onClose={() => setSuspending(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSuspending(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => act(`admin/workspaces/${id}/suspend`, undefined, "Account sospeso.")}
            >
              Sospendi
            </Button>
          </>
        }
      >
        <p>
          Il cliente non potrà accedere e i suoi QR smetteranno di reindirizzare finché non lo
          riattivi.
        </p>
      </Modal>
    </div>
  );
}
