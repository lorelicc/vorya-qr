"use client";
import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { Card, buttonClass } from "@/components/ui";
import { formatDay, formatNumber } from "@/lib/format";
import { useCountUp } from "@/lib/motion";
import type { StatsSummary } from "@/lib/types";
import { NoStats } from "@/components/illustrations";
import { Breakdown } from "./Breakdown";
import { LineChart } from "./LineChart";
import { RangePicker, type RangeValue } from "./RangePicker";
import styles from "./StatsView.module.css";

const regions =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["it"], { type: "region" })
    : null;

export function countryName(code: string | null | undefined): string {
  if (!code) return "Altro";
  try {
    return regions?.of(code) ?? code;
  } catch {
    return code;
  }
}

function Figure({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const shown = useCountUp(value);
  return (
    <Card>
      <p className={styles.label}>{label}</p>
      <p className={styles.value} aria-label={formatNumber(value)}>
        {formatNumber(shown)}
      </p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </Card>
  );
}

/** Shared body of the per-QR and per-company statistics. */
export function StatsDashboard({
  stats,
  range,
  onRange,
  csvHref,
  extra,
  showClicks,
}: {
  stats: StatsSummary;
  range: RangeValue;
  onRange: (value: RangeValue) => void;
  csvHref: string;
  extra?: ReactNode;
  showClicks: boolean;
}) {
  const period = `${formatDay(stats.range.first)} – ${formatDay(stats.range.last)}`;
  const countries = stats.countries.map((c) => ({ ...c, label: countryName(c.key) }));
  const cities = stats.cities.map((c) => ({
    label: `${c.label} (${c.country ?? "?"})`,
    count: c.count,
  }));
  return (
    <>
      <div className={styles.toolbar}>
        <RangePicker value={range} onChange={onRange} />
        <a className={buttonClass({ variant: "secondary" })} href={csvHref} download>
          <Download size={16} aria-hidden="true" /> Esporta CSV
        </a>
      </div>
      {stats.retention_days !== null && (
        <p className={styles.note}>
          Il tuo piano conserva le statistiche per {formatNumber(stats.retention_days)} giorni.
          Statistiche illimitate: disponibile nel piano Plus.
        </p>
      )}
      <div className={styles.figures}>
        <Figure label="Scansioni" value={stats.scans} hint={period} />
        <Figure
          label="Visitatori unici (stima)"
          value={stats.unique_estimate}
          hint="Somma dei visitatori unici di ogni giorno"
        />
        {showClicks && <Figure label="Click sulla pagina" value={stats.clicks} hint={period} />}
      </div>
      <Card title="Andamento" description={`${period}, ora italiana.`}>
        {stats.scans === 0 ? (
          <div className={styles.emptyChart}>
            <NoStats />
            <p className="muted">Nessuna scansione nel periodo selezionato.</p>
          </div>
        ) : (
          <LineChart
            days={stats.daily}
            series={[
              { key: "count", label: "Scansioni", tone: "main" },
              { key: "unique", label: "Visitatori unici (stima)", tone: "soft" },
            ]}
          />
        )}
      </Card>
      {extra}
      <div className="grid-2">
        <Card title="Paesi">
          <Breakdown
            items={countries}
            empty={stats.geo_available ? "Ancora nessuna scansione." : "Luoghi non disponibili."}
          />
        </Card>
        <Card title="Città">
          <Breakdown
            items={cities}
            empty={stats.geo_available ? "Ancora nessuna scansione." : "Luoghi non disponibili."}
          />
        </Card>
        <Card title="Dispositivi">
          <Breakdown items={stats.devices} />
        </Card>
        <Card title="Sistemi operativi">
          <Breakdown items={stats.os} />
        </Card>
        <Card title="Browser">
          <Breakdown items={stats.browsers} />
        </Card>
        {showClicks && (
          <Card title="Elementi più cliccati">
            <Breakdown items={stats.top_clicks} empty="Ancora nessun click." />
          </Card>
        )}
      </div>
      <p className={styles.footnote}>
        Non salviamo indirizzi IP: luogo approssimativo e stima dei visitatori unici sono calcolati
        al momento e l&apos;IP viene scartato. Bot e anteprime dei link sono esclusi (
        {formatNumber(stats.bot_scans)} nel periodo).{" "}
        {stats.geo_available && (
          <a href={stats.attribution.url} target="_blank" rel="noopener noreferrer">
            {stats.attribution.text}
          </a>
        )}
      </p>
    </>
  );
}
