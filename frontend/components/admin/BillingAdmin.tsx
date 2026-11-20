"use client";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  IconButton,
  Input,
  Select,
  useToast,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import styles from "./admin.module.css";

type Status = {
  key_configured: boolean;
  mode: "test" | "live";
  live_allowed: boolean;
  webhook_configured: boolean;
  settings: { grace_days: number };
};
type Price = {
  id: number;
  plan_id: string;
  cycle: "monthly" | "yearly";
  stripe_price_id: string;
  amount_cents: number;
  currency: string;
  active: boolean;
};
type Payment = {
  invoice_id: string;
  workspace: string;
  email: string;
  plan_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
};
type PlanRow = { id: string; name: string };

/** Admin: Stripe status, price links (amounts live in Stripe, never in code), grace and payments. */
export function BillingAdmin({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ plan_id: "pro", cycle: "monthly", stripe_price_id: "" });
  const [days, setDays] = useState({ grace_days: "7" });

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    Promise.all([
      api<Status>("admin/billing/status"),
      api<Price[]>("admin/billing/prices"),
      api<Payment[]>("admin/billing/payments"),
      api<PlanRow[]>("admin/plans"),
    ])
      .then(([s, p, pay, pl]) => {
        setStatus(s);
        setPrices(p);
        setPayments(pay);
        setPlans(pl);
        setDays({
          grace_days: String(s.settings.grace_days),
        });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [tick]);

  async function link(event: FormEvent) {
    event.preventDefault();
    try {
      await api("admin/billing/prices", "POST", form);
      setForm({ ...form, stripe_price_id: "" });
      toast.show("Prezzo collegato.");
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function saveDays(event: FormEvent) {
    event.preventDefault();
    try {
      await api("admin/billing/settings", "PUT", {
        grace_days: Number(days.grace_days),
      });
      toast.show("Impostazioni salvate.");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function deactivate(price: Price) {
    try {
      await api(`admin/billing/prices/${price.id}`, "DELETE");
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!status) return <p className="muted">Caricamento…</p>;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pagamenti</h1>
          <p>Prezzi collegati a Stripe, periodi di tolleranza e elenco dei pagamenti.</p>
        </div>
        <ButtonLink href="/api/admin/billing/payments.csv" variant="secondary" download>
          Esporta CSV per la fatturazione
        </ButtonLink>
      </div>
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <Card title="Stripe">
          <p>
            Chiave:{" "}
            {status.key_configured ? (
              <Badge tone="success">configurata</Badge>
            ) : (
              <Badge tone="danger">mancante</Badge>
            )}{" "}
            Modalità:{" "}
            <Badge tone={status.mode === "live" ? "warning" : "info"}>{status.mode}</Badge> Webhook:{" "}
            {status.webhook_configured ? (
              <Badge tone="success">segreto presente</Badge>
            ) : (
              <Badge tone="danger">mancante</Badge>
            )}
          </p>
          {status.mode === "live" && !status.live_allowed && (
            <p role="alert">Chiave live rifiutata: manca STRIPE_LIVE_ALLOWED=true nell’ambiente.</p>
          )}
        </Card>

        <Card
          title="Prezzi dei piani"
          description="Importo e ciclo si leggono da Stripe: qui colleghi l’ID prezzo."
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Piano</th>
                <th>Ciclo</th>
                <th>Importo</th>
                <th>ID Stripe</th>
                <th>Stato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id}>
                  <td>{p.plan_id}</td>
                  <td>{p.cycle === "monthly" ? "Mensile" : "Annuale"}</td>
                  <td>{formatMoney(p.amount_cents, p.currency)}</td>
                  <td>
                    <code>{p.stripe_price_id}</code>
                  </td>
                  <td>
                    <Badge tone={p.active ? "success" : "neutral"}>
                      {p.active ? "In vendita" : "Archiviato"}
                    </Badge>
                  </td>
                  <td>
                    {canWrite && p.active && (
                      <IconButton label="Ritira dalla vendita" onClick={() => deactivate(p)}>
                        <Trash2 size={16} />
                      </IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canWrite && (
            <form
              onSubmit={link}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-3)",
                alignItems: "end",
                marginTop: "var(--space-4)",
              }}
            >
              <Select
                label="Piano"
                value={form.plan_id}
                onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Ciclo"
                value={form.cycle}
                onChange={(e) => setForm({ ...form, cycle: e.target.value })}
              >
                <option value="monthly">Mensile</option>
                <option value="yearly">Annuale</option>
              </Select>
              <Input
                label="ID prezzo Stripe"
                value={form.stripe_price_id}
                placeholder="price_…"
                onChange={(e) => setForm({ ...form, stripe_price_id: e.target.value.trim() })}
              />
              <Button type="submit" disabled={!form.stripe_price_id}>
                Collega
              </Button>
            </form>
          )}
        </Card>

        {canWrite && (
          <Card title="Tolleranza">
            <form
              onSubmit={saveDays}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-3)",
                alignItems: "end",
              }}
            >
              <Input
                label="Giorni di tolleranza (pagamento fallito)"
                type="number"
                min={0}
                max={60}
                value={days.grace_days}
                onChange={(e) => setDays({ ...days, grace_days: e.target.value })}
              />

              <Button type="submit" variant="secondary">
                Salva
              </Button>
            </form>
          </Card>
        )}

        <Card title="Ultimi pagamenti">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Piano</th>
                <th>Importo</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 50).map((p) => (
                <tr key={p.invoice_id}>
                  <td>{p.paid_at ? formatDate(p.paid_at) : "—"}</td>
                  <td>
                    {p.workspace}
                    <br />
                    <small>{p.email}</small>
                  </td>
                  <td>{p.plan_id ?? "—"}</td>
                  <td>{formatMoney(p.amount_cents, p.currency)}</td>
                  <td>
                    <Badge tone={p.status === "paid" ? "success" : "danger"}>
                      {p.status === "paid" ? "Pagato" : "Non riuscito"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
