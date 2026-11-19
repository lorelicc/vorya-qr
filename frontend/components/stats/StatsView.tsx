"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SkeletonList } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { QrCode, QrStats } from "@/lib/types";
import { StatsDashboard } from "./StatsDashboard";
import styles from "./StatsView.module.css";
import { useStats } from "./useStats";

export function StatsView({ id }: { id: number }) {
  const { api: base, app } = useCompany();
  const [qr, setQr] = useState<QrCode | null>(null);
  const [qrError, setQrError] = useState("");
  const { range, setRange, data, error, csvHref } = useStats<QrStats>(
    `${base}/qr-codes/${id}/stats`,
  );

  useEffect(() => {
    api<QrCode>(`${base}/qr-codes/${id}`)
      .then(setQr)
      .catch((err) => setQrError(errorMessage(err)));
  }, [base, id]);

  if (qrError || error) return <p role="alert">{qrError || error}</p>;
  if (!qr || !data) return <SkeletonList rows={4} />;

  return (
    <div className="page">
      <Link href={`${app}/qr/${qr.id}`} className={styles.back}>
        <ArrowLeft size={16} /> {qr.name}
      </Link>
      <div className="page-header">
        <div>
          <h1>Statistiche</h1>
          <p>
            {formatNumber(data.total_scans)} scansioni in totale
            {data.last_scan_at ? `, l'ultima il ${formatDateTime(data.last_scan_at)}` : ""}.
          </p>
        </div>
      </div>
      <StatsDashboard
        stats={data}
        range={range}
        onRange={setRange}
        csvHref={csvHref}
        showClicks={qr.destination === "page"}
        markers={data.markers}
      />
    </div>
  );
}
