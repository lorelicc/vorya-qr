"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { QrCode, QrStats } from "@/lib/types";
import { Breakdown } from "./Breakdown";
import { DailyChart } from "./DailyChart";
import styles from "./StatsView.module.css";

export function StatsView({ id }: { id: number }) {
  const [qr, setQr] = useState<QrCode | null>(null);
  const [stats, setStats] = useState<QrStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<QrCode>(`qr-codes/${id}`), api<QrStats>(`qr-codes/${id}/stats`)])
      .then(([q, s]) => {
        setQr(q);
        setStats(s);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <p role="alert">{error}</p>;
  if (!qr || !stats)
    return (
      <p className="muted" role="status">
        Caricamento…
      </p>
    );

  const figures = [
    { label: "Scansioni totali", value: formatNumber(stats.total_scans) },
    { label: "Ultimi 30 giorni", value: formatNumber(stats.scans_last_30_days) },
    {
      label: "Ultima scansione",
      value: stats.last_scan_at ? formatDateTime(stats.last_scan_at) : "Nessuna",
    },
  ];

  return (
    <div className="page">
      <Link href={`/app/qr/${qr.id}`} className={styles.back}>
        <ArrowLeft size={16} /> {qr.name}
      </Link>
      <div className="page-header">
        <div>
          <h1>Statistiche</h1>
          <p>
            Conteggiamo le scansioni, non le persone: senza indirizzi IP non è possibile distinguere
            chi scansiona più volte. Bot e anteprime dei link sono esclusi (
            {formatNumber(stats.bot_scans)} finora).
          </p>
        </div>
      </div>
      <div className={styles.figures}>
        {figures.map((figure) => (
          <Card key={figure.label}>
            <p className={styles.label}>{figure.label}</p>
            <p className={styles.value}>{figure.value}</p>
          </Card>
        ))}
      </div>
      <Card title="Scansioni giornaliere" description="Ultimi 30 giorni, ora italiana.">
        <DailyChart days={stats.daily} />
      </Card>
      <div className="grid-2">
        <Card title="Dispositivi">
          <Breakdown items={stats.devices} />
        </Card>
        <Card title="Sistemi operativi">
          <Breakdown items={stats.os} />
        </Card>
      </div>
    </div>
  );
}
