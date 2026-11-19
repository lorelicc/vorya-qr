"use client";
import Link from "next/link";
import { Card, SkeletonList } from "@/components/ui";
import { TYPE_BY_KEY } from "@/components/qr/types/meta";
import { useCompany } from "@/lib/company-context";
import { formatNumber } from "@/lib/format";
import type { CompanyStats } from "@/lib/types";
import { StatsDashboard } from "./StatsDashboard";
import styles from "./StatsView.module.css";
import { useStats } from "./useStats";

export function CompanyStatsView() {
  const { company, api: base, app } = useCompany();
  const { range, setRange, data, error, csvHref } = useStats<CompanyStats>(`${base}/stats`);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <SkeletonList rows={4} />;
  const top = (
    <Card title="QR più scansionati">
      {data.top_qr.length === 0 ? (
        <p className="muted">Ancora nessuna scansione nel periodo.</p>
      ) : (
        <ol className={styles.top}>
          {data.top_qr.map((qr) => (
            <li key={qr.id}>
              <Link href={`${app}/qr/${qr.id}/stats`}>{qr.name}</Link>
              <span className="muted">
                {TYPE_BY_KEY[qr.qr_type as keyof typeof TYPE_BY_KEY]?.label ?? qr.qr_type}
              </span>
              <strong>{formatNumber(qr.count)}</strong>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Statistiche</h1>
          <p>Tutti i QR dinamici di {company.name}.</p>
        </div>
      </div>
      <StatsDashboard
        stats={data}
        range={range}
        onRange={setRange}
        csvHref={csvHref}
        extra={top}
        showClicks
      />
    </div>
  );
}
