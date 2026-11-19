"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GiftPlan } from "@/components/illustrations";
import { UsageMeter } from "@/components/qr/UsageMeter";
import { Badge, Button, ButtonLink, Card, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { STATE_LABEL, formatMoney, type BillingInfo } from "@/lib/billing";
import { daysLeft, formatDate } from "@/lib/format";
import { formatBytes } from "@/lib/upload";
import { BillingBanner } from "./BillingBanner";
import { BillingProfileForm } from "./BillingProfileForm";
import { PlanCards } from "./PlanCards";
import { useCheckout } from "./useCheckout";
import styles from "./billing.module.css";

const TONE = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  canceled: "danger",
  unpaid: "danger",
  gift: "success",
} as const;

export function AccountPlan() {
  const toast = useToast();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    api<BillingInfo>("account/billing")
      .then(setInfo)
      .catch((err) => setError(errorMessage(err)));
  }, [tick]);
  const { choose, busy, dialogs } = useCheckout(info, load);

  async function portal() {
    setWorking(true);
    try {
      const { url } = await api<{ url: string }>("account/billing/portal", "POST");
      window.location.assign(url);
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setWorking(false);
    }
  }

  async function cancel(value: boolean) {
    setWorking(true);
    try {
      await api("account/billing/cancel", "POST", { cancel: value });
      toast.show(value ? "Il piano non si rinnoverà." : "Rinnovo riattivato.");
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setWorking(false);
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!info)
    return (
      <p className="muted" role="status">
        Caricamento…
      </p>
    );

  const price = info.cycle ? info.plan.prices[info.cycle] : undefined;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Piano e utilizzo</h1>
          <p>Piano, pagamenti e dati di fatturazione.</p>
        </div>
      </div>
      <BillingBanner info={info} />
      {info.state === "gift" && info.grant_until && (
        <div className={styles.banner} data-tone="info" role="status">
          <GiftPlan />
          <span>
            Hai un piano in omaggio dal team di Vorya QR: tutte le funzioni di{" "}
            <strong>{info.plan.name}</strong> sono attive fino al {formatDate(info.grant_until)}.
          </span>
        </div>
      )}
      <div className={styles.stack}>
        <Card title={`Piano ${info.plan.name}`} description={info.plan.description}>
          <div className={styles.row} style={{ marginBottom: "var(--space-4)" }}>
            <Badge tone={TONE[info.state]}>{STATE_LABEL[info.state]}</Badge>
          </div>
          <dl className={styles.summary}>
            {info.state === "trialing" && info.trial_ends_at && (
              <>
                <dt>Prova gratuita</dt>
                <dd>
                  {daysLeft(info.trial_ends_at)} giorni rimasti (fino al{" "}
                  {formatDate(info.trial_ends_at)}
                  ). Durante la prova hai i limiti del piano Pro.
                </dd>
              </>
            )}
            {info.has_subscription && price && info.cycle && (
              <>
                <dt>Importo</dt>
                <dd>
                  {formatMoney(price.amount_cents, price.currency)} /{" "}
                  {info.cycle === "yearly" ? "anno" : "mese"}
                </dd>
              </>
            )}
            {info.has_subscription && info.period_end && (
              <>
                <dt>{info.cancel_at_period_end ? "Termina il" : "Prossimo rinnovo"}</dt>
                <dd>{formatDate(info.period_end)}</dd>
              </>
            )}
          </dl>
          <div className={styles.row} style={{ marginTop: "var(--space-4)" }}>
            {info.has_subscription && (
              <>
                <Button variant="secondary" loading={working} onClick={portal}>
                  Metodo di pagamento e ricevute
                </Button>
                <Button
                  variant="ghost"
                  loading={working}
                  onClick={() => cancel(!info.cancel_at_period_end)}
                >
                  {info.cancel_at_period_end ? "Riattiva il rinnovo" : "Non rinnovare"}
                </Button>
              </>
            )}
          </div>
          <div className={styles.meters} style={{ marginTop: "var(--space-5)" }}>
            <UsageMeter label="QR dinamici" usage={info.usage.dynamic} />
            <UsageMeter label="QR statici" usage={info.usage.static} />
            <UsageMeter label="Aziende" usage={info.usage.companies} />
            <UsageMeter label="Spazio file" usage={info.usage.storage} format={formatBytes} />
          </div>
        </Card>

        <Card title={info.has_subscription ? "Cambia piano" : "Scegli un piano"}>
          {info.online_payments ? (
            <PlanCards
              plans={info.plans}
              labels={info.type_labels}
              currentPlanId={info.has_subscription ? info.plan.id : null}
              currentCycle={info.has_subscription ? info.cycle : null}
              onChoose={choose}
              busy={busy}
            />
          ) : (
            <p>
              I pagamenti online non sono ancora attivi: scrivici per attivare un piano.{" "}
              <Link href="/plans">Vedi i piani</Link>
            </p>
          )}
          <p className={styles.hint}>
            Passando a un piano superiore o inferiore, Stripe calcola il conguaglio sul periodo già
            pagato.
          </p>
        </Card>

        <Card title="Dati di fatturazione">
          {editing || !info.profile ? (
            <BillingProfileForm
              initial={info.profile}
              onSaved={async () => {
                setEditing(false);
                load();
                toast.show("Dati di fatturazione salvati.");
              }}
            />
          ) : (
            <>
              <dl className={styles.summary}>
                <dt>Intestatario</dt>
                <dd>{info.profile.legal_name}</dd>
                {info.profile.vat && (
                  <>
                    <dt>Partita IVA</dt>
                    <dd>{info.profile.vat}</dd>
                  </>
                )}
                {info.profile.tax_code && (
                  <>
                    <dt>Codice fiscale</dt>
                    <dd>{info.profile.tax_code}</dd>
                  </>
                )}
                <dt>Indirizzo</dt>
                <dd>
                  {info.profile.address}, {info.profile.zip} {info.profile.city}{" "}
                  {info.profile.province && `(${info.profile.province})`}
                </dd>
                <dt>SDI / PEC</dt>
                <dd>{[info.profile.sdi_code, info.profile.pec].filter(Boolean).join(" · ")}</dd>
              </dl>
              <div style={{ marginTop: "var(--space-4)" }}>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Modifica
                </Button>
              </div>
            </>
          )}
        </Card>

        {info.payments.length > 0 && (
          <Card title="Pagamenti">
            <table className={styles.payments}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Importo</th>
                  <th>Stato</th>
                  <th>
                    <span className="visually-hidden">Ricevuta</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {info.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                    <td>{formatMoney(p.amount_cents, p.currency)}</td>
                    <td>
                      <Badge tone={p.status === "paid" ? "success" : "danger"}>
                        {p.status === "paid" ? "Pagato" : "Non riuscito"}
                      </Badge>
                    </td>
                    <td>
                      {p.document_url && (
                        <ButtonLink href={p.document_url} variant="ghost">
                          Ricevuta
                        </ButtonLink>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      {dialogs}
    </div>
  );
}
