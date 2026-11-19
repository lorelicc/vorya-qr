"use client";
import { BarChart3, Copy, Download, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";
import type { QrActions } from "./useQrActions";
import styles from "./QrList.module.css";

export function QrQuickActions({ qr, actions }: { qr: QrCode; actions: QrActions }) {
  const { app } = useCompany();
  const busy = actions.busy === qr.id;
  const dynamic = qr.kind === "dynamic";
  return (
    <div className={styles.quick}>
      <a
        href={actions.image(qr, "png")}
        download
        title="Scarica PNG"
        aria-label={`Scarica ${qr.name} in PNG`}
      >
        <Download size={16} />
      </a>
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
    </div>
  );
}
