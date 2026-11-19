"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { QrCode } from "@/lib/types";
import { DownloadPanel } from "./DownloadPanel";
import { DynamicControls } from "./DynamicControls";
import { KindBadge, StatusBadge } from "./QrBadges";
import { QrEditor } from "./QrEditor";
import { StaticControls } from "./StaticControls";
import styles from "./QrDetail.module.css";

export function QrDetail({ id }: { id: number }) {
  const [qr, setQr] = useState<QrCode | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api<QrCode>(`qr-codes/${id}`)
      .then(setQr)
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error) return <p role="alert">{error}</p>;
  if (!qr)
    return (
      <p className="muted" role="status">
        Caricamento…
      </p>
    );

  return (
    <div className="page">
      <Link href="/app" className={styles.back}>
        <ArrowLeft size={16} /> Tutti i codici QR
      </Link>
      <div className="page-header">
        <div>
          <h1>{qr.name}</h1>
          <div className={`row ${styles.badges}`}>
            <KindBadge kind={qr.kind} />
            <StatusBadge qr={qr} />
          </div>
        </div>
      </div>
      <div className={styles.panels}>
        {qr.kind === "dynamic" ? (
          <DynamicControls qr={qr} onChange={setQr} />
        ) : (
          <StaticControls qr={qr} />
        )}
        <DownloadPanel qrId={qr.id} key={version} />
      </div>
      <QrEditor
        key={qr.updated_at}
        initial={qr}
        onSaved={(saved) => {
          setQr(saved);
          setVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
