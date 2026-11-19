"use client";
import { Download } from "lucide-react";
import { useState } from "react";
import { Card, Select, buttonClass } from "@/components/ui";
import styles from "./DownloadPanel.module.css";

const SIZES = [512, 1024, 2048, 4096];

/** Downloads always reflect the saved QR (save changes first). */
export function DownloadPanel({ qrId }: { qrId: number }) {
  const [size, setSize] = useState(1024);
  return (
    <Card
      title="Scarica"
      description="PNG per il web e le presentazioni, SVG per la stampa in qualsiasi formato."
    >
      <div className="stack">
        <Select
          label="Dimensione PNG"
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
        >
          {SIZES.map((value) => (
            <option key={value} value={value}>
              {value} × {value} px
            </option>
          ))}
        </Select>
        <div className={styles.buttons}>
          <a
            className={buttonClass({ variant: "secondary" })}
            href={`/api/qr-codes/${qrId}/image.png?size=${size}`}
            download
          >
            <Download size={16} /> PNG
          </a>
          <a
            className={buttonClass({ variant: "secondary" })}
            href={`/api/qr-codes/${qrId}/image.svg`}
            download
          >
            <Download size={16} /> SVG
          </a>
        </div>
        <p className={styles.hint}>
          Il PNG viene generato alla dimensione intera più vicina che non supera quella scelta, per
          mantenere i moduli nitidi. Il download usa sempre l’ultima versione salvata.
        </p>
      </div>
    </Card>
  );
}
