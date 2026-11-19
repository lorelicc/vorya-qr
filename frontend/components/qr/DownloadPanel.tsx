"use client";
import { Download } from "lucide-react";
import { useState } from "react";
import { Card, Input, Select, buttonClass } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import styles from "./DownloadPanel.module.css";

const PRESETS = [512, 1024, 2048];

/** PNG at an exact size (preset or free), SVG and vector PDF. Always the saved version. */
export function DownloadPanel({ qrId }: { qrId: number }) {
  const { api: base } = useCompany();
  const [choice, setChoice] = useState("1024");
  const [custom, setCustom] = useState(1500);
  const size = choice === "custom" ? Math.min(4096, Math.max(128, custom || 0)) : Number(choice);
  const href = (ext: string, query = "") => `/api/${base}/qr-codes/${qrId}/image.${ext}${query}`;
  return (
    <Card
      title="Scarica"
      description="PNG per web e presentazioni, SVG e PDF vettoriali per la stampa in qualsiasi formato."
    >
      <div className="stack">
        <div className={styles.sizes}>
          <Select label="Dimensione PNG" value={choice} onChange={(e) => setChoice(e.target.value)}>
            {PRESETS.map((value) => (
              <option key={value} value={value}>
                {value} × {value} px
              </option>
            ))}
            <option value="custom">Personalizzata…</option>
          </Select>
          {choice === "custom" && (
            <Input
              label="Lato in pixel (128–4096)"
              type="number"
              min={128}
              max={4096}
              value={custom}
              onChange={(e) => setCustom(Number(e.target.value))}
            />
          )}
        </div>
        <div className={styles.buttons}>
          <a
            className={buttonClass({ variant: "secondary" })}
            href={href("png", `?size=${size}`)}
            download
          >
            <Download size={16} /> PNG
          </a>
          <a className={buttonClass({ variant: "secondary" })} href={href("svg")} download>
            <Download size={16} /> SVG
          </a>
          <a className={buttonClass({ variant: "secondary" })} href={href("pdf")} download>
            <Download size={16} /> PDF
          </a>
        </div>
        <p className={styles.hint}>Il download usa sempre l’ultima versione salvata.</p>
      </div>
    </Card>
  );
}
