"use client";
import { BarChart3, Copy, Download, FolderInput, Pause, Play, QrCode, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSelection } from "@/components/organize/SelectionContext";
import { useCompany } from "@/lib/company-context";
import type { QrCode as Qr } from "@/lib/types";
import type { QrActions } from "./useQrActions";
import styles from "./QrList.module.css";

export function QrQuickActions({ qr, actions }: { qr: Qr; actions: QrActions }) {
  const { app } = useCompany();
  const busy = actions.busy === qr.id;
  const dynamic = qr.kind === "dynamic";
  const selection = useSelection();
  return (
    <div className={styles.quick}>
      {qr.has_qr ? (
        <a
          href={actions.image(qr, "png")}
          download
          title="Scarica PNG"
          aria-label={`Scarica ${qr.name} in PNG`}
        >
          <Download size={16} />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => actions.generateQr(qr)}
          disabled={busy}
          title="Genera QR"
          aria-label={`Genera QR per ${qr.name}`}
        >
          <QrCode size={16} />
        </button>
      )}
      {selection && (
        <button
          type="button"
          onClick={() => selection.onMove(qr)}
          title="Sposta in una cartella"
          aria-label={`Sposta ${qr.name} in una cartella`}
        >
          <FolderInput size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={() => actions.duplicate(qr)}
        disabled={busy}
        title="Duplica"
        aria-label={`Duplica ${qr.name}`}
      >
        <Copy size={16} />
      </button>
      {dynamic && (
        <Link
          href={`${app}/qr/${qr.id}/stats`}
          title="Statistiche"
          aria-label={`Statistiche di ${qr.name}`}
        >
          <BarChart3 size={16} />
        </Link>
      )}
      {dynamic && qr.status !== "blocked" && (
        <button
          type="button"
          onClick={() => actions.toggle(qr)}
          disabled={busy}
          title={qr.status === "paused" ? "Riattiva" : "Metti in pausa"}
          aria-label={`${qr.status === "paused" ? "Riattiva" : "Metti in pausa"} ${qr.name}`}
        >
          {qr.status === "paused" ? <Play size={16} /> : <Pause size={16} />}
        </button>
      )}
      {actions.askDelete && (
        <button
          type="button"
          className={styles.danger}
          onClick={() => actions.askDelete?.(qr)}
          disabled={busy}
          title="Elimina"
          aria-label={`Elimina ${qr.name}`}
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}
