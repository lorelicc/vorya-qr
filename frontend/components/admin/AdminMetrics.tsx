"use client";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Card } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/billing";
import styles from "./admin.module.css";

type Funnel = { signups: number; activated: number; paying: number };
type Metrics = {
  computed_at: string;
  signups: {
    day: number;
    week: number;
    month: number;
    total: number;
    series: Record<string, number>;
  };
  activation: { cohort: number; activated: number; percent: number | null };
  trials_active: number;
  conversion: { ended: number; paying: number; percent: number | null };
  revenue: { mrr_cents: number; arr_cents: number; payers: number; arpa_cents: number | null };
  churn: { cancelled_30d: number; percent: number | null };
  plans: Record<string, number>;
  plan_changes_30d: { upgrades: number; downgrades: number };
  funnel: {
    generator: Record<string, number>;
    sources: Record<string, Funnel>;
    landings: Record<string, { view: number; download: number; signups: number }>;
  };
  usage: {
    scans_30d: number;
    types: Record<string, number>;
    companies: number;
    companies_per_account: number | null;
  };
};

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={styles.kpi}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

/** Bars drawn as SVG (same look as the stats charts); `series` is {label: value}. */
function Bars({ series, title }: { series: Record<string, number>; title: string }) {
  const entries = Object.entries(series);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const width = 100 / entries.length;
  return (
    <svg
      viewBox="0 0 100 40"
      role="img"
      aria-label={title}
      className={styles.bars}
      preserveAspectRatio="none"
    >
      {entries.map(([label, value], i) => (
        <rect
          key={label}
          x={i * width + width * 0.15}
          width={width * 0.7}
          y={40 - (value / max) * 38}
          height={(value / max) * 38}
          rx={0.6}
        >
          <title>{`${label}: ${value}`}</title>
        </rect>
      ))}
    </svg>
  );
}

export function AdminMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Metrics>("admin/metrics")
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p className="muted">Caricamento…</p>;
  const g = data.funnel.generator;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Metriche</h1>
          <p>
            Calcolate dal worker ogni ora (ultimo calcolo:{" "}
            {new Date(data.computed_at).toLocaleString("it-IT")}).
          </p>
        </div>
        <ButtonLink href="/api/admin/metrics/export.csv" variant="secondary" download>
          Esporta CSV
        </ButtonLink>
      </div>
      <div className={styles.kpis}>
        <Kpi
          label="Iscritti oggi"
          value={data.signups.day}
          hint={`${data.signups.week} in 7 giorni · ${data.signups.month} in 30`}
        />
        <Kpi
          label="Attivazione"
          value={pct(data.activation.percent)}
          hint={`${data.activation.activated}/${data.activation.cohort} con il primo QR dinamico entro 7 giorni`}
        />
        <Kpi label="Trial attivi" value={data.trials_active} />
        <Kpi
          label="Trial → pagante"
          value={pct(data.conversion.percent)}
          hint={`${data.conversion.paying}/${data.conversion.ended} negli ultimi 90 giorni`}
        />
        <Kpi
          label="MRR"
          value={formatMoney(data.revenue.mrr_cents)}
          hint={`ARR ${formatMoney(data.revenue.arr_cents)}`}
        />
        <Kpi
          label="ARPA"
          value={data.revenue.arpa_cents === null ? "—" : formatMoney(data.revenue.arpa_cents)}
          hint={`${data.revenue.payers} paganti`}
        />
        <Kpi
          label="Churn mensile"
          value={pct(data.churn.percent)}
          hint={`${data.churn.cancelled_30d} annullati in 30 giorni`}
        />
        <Kpi
          label="Upgrade / downgrade"
          value={`${data.plan_changes_30d.upgrades} / ${data.plan_changes_30d.downgrades}`}
          hint="ultimi 30 giorni"
        />
      </div>
      <Card title="Iscritti per giorno (ultimi 30 giorni)">
        <Bars series={data.signups.series} title="Iscritti per giorno" />
      </Card>
      <div className="grid-2">
        <Card
          title="Distribuzione dei piani"
          description="Piano in vigore oggi (chi è scaduto o ha annullato è sul Free)."
        >
          <Bars series={data.plans} title="Account per piano" />
          <p className={styles.legend}>
            {Object.entries(data.plans)
              .map(([p, n]) => `${p}: ${n}`)
              .join(" · ")}
          </p>
        </Card>
        <Card title="Utilizzo">
          <dl className={styles.facts}>
            <dt>Scansioni (30 giorni)</dt>
            <dd>{data.usage.scans_30d}</dd>
            <dt>Aziende per account</dt>
            <dd>{data.usage.companies_per_account ?? "—"}</dd>
            <dt>Tipi più usati</dt>
            <dd>
              {Object.entries(data.usage.types)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([t, n]) => `${t} (${n})`)
                .join(", ") || "—"}
            </dd>
          </dl>
        </Card>
      </div>
      <Card
        title="Funnel del generatore gratuito (30 giorni)"
        description="Visite → anteprime → download → iscritti → primo QR dinamico → paganti."
      >
        <dl className={styles.facts}>
          <dt>Visite</dt>
          <dd>{g.view ?? 0}</dd>
          <dt>Anteprime</dt>
          <dd>{g.preview ?? 0}</dd>
          <dt>Download</dt>
          <dd>{g.download ?? 0}</dd>
        </dl>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Iscritti</th>
              <th>Primo QR dinamico</th>
              <th>Paganti</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.funnel.sources).map(([source, f]) => (
              <tr key={source}>
                <td>{source}</td>
                <td>{f.signups}</td>
                <td>{f.activated}</td>
                <td>{f.paying}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Pagina di ingresso</th>
              <th>Visite del generatore</th>
              <th>Download</th>
              <th>Iscritti</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.funnel.landings).map(([landing, l]) => (
              <tr key={landing}>
                <td>{landing}</td>
                <td>{l.view}</td>
                <td>{l.download}</td>
                <td>{l.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Button variant="ghost" onClick={() => window.location.reload()}>
        Ricarica
      </Button>
    </div>
  );
}
