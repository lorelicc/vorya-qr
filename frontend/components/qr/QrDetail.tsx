"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import type { QrCode } from "@/lib/types";
import type { UploadedFile } from "@/lib/upload";
import { toPageFile } from "./pages/shared";
import { DownloadPanel } from "./DownloadPanel";
import { GenerateQrCard } from "@/components/links/GenerateQrCard";
import { DynamicControls } from "./DynamicControls";
import { KindBadge, StatusBadge } from "./QrBadges";
import { QrEditor } from "./QrEditor";
import { StaticControls } from "./StaticControls";
import { Celebration } from "./wizard/Celebration";
import styles from "./QrDetail.module.css";

export function QrDetail({ id }: { id: number }) {
  const { api: base, app } = useCompany();
  const [qr, setQr] = useState<QrCode | null>(null);
  const [page, setPage] = useState<PageDoc | null>(null);
  const [files, setFiles] = useState<PageFiles | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  // The onboarding sample lands here with ?created=1: celebrate once, then clean the URL.
  const params = useSearchParams();
  const [celebrate] = useState(() => params.has("created"));
  useEffect(() => {
    if (celebrate) window.history.replaceState(null, "", window.location.pathname);
  }, [celebrate]);

  useEffect(() => {
    Promise.all([
      api<QrCode>(`${base}/qr-codes/${id}`),
      api<{ files: UploadedFile[] }>(`${base}/files`),
    ])
      .then(async ([loaded, listing]) => {
        setFiles(Object.fromEntries(listing.files.map((f) => [f.id, toPageFile(f)])));
        if (loaded.destination === "page")
          setPage(await api<PageDoc>(`${base}/qr-codes/${id}/page`));
        setQr(loaded);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [base, id]);

  if (error) return <p role="alert">{error}</p>;
  if (!qr || !files)
    return (
      <p className="muted" role="status">
        Caricamento…
      </p>
    );

  return (
    <div className="page">
      <Link href={app} className={styles.back}>
        <ArrowLeft size={16} /> Tutti i codici QR
      </Link>
      {celebrate && (
        <div className={styles.celebrate} role="status">
          <Celebration />
          <p>
            <strong>QR di esempio creato.</strong> Modifica la pagina qui sotto e scaricalo quando è
            pronto.
          </p>
        </div>
      )}
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
        {qr.has_qr ? (
          <DownloadPanel qrId={qr.id} key={version} />
        ) : (
          <GenerateQrCard qr={qr} onDone={setQr} />
        )}
      </div>
      <QrEditor
        key={qr.updated_at}
        initial={qr}
        initialPage={page}
        initialFiles={files}
        onSaved={(saved) => {
          setQr(saved);
          setVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
