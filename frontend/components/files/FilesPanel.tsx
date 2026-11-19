"use client";
import { FileAudio, FileText, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { UsageMeter } from "@/components/qr/UsageMeter";
import { Card, IconButton, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { formatBytes, type UploadedFile } from "@/lib/upload";
import styles from "./FilesPanel.module.css";

type Listing = {
  files: UploadedFile[];
  storage: { used: number; limit: number | null; max_file_bytes: number };
};

export function FilesPanel() {
  const { api: base } = useCompany();
  const toast = useToast();
  const [data, setData] = useState<Listing | null>(null);

  const load = useCallback(() => {
    api<Listing>(`${base}/files`)
      .then(setData)
      .catch((err) => toast.show(errorMessage(err), "error"));
  }, [base, toast]);
  useEffect(() => load(), [load]);

  async function remove(file: UploadedFile) {
    try {
      await api(`${base}/files/${file.id}`, "DELETE");
      toast.show("File eliminato.");
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  if (!data) return null;
  const { used, limit, max_file_bytes } = data.storage;
  return (
    <Card
      title="File"
      description={`Immagini, PDF e audio usati nelle pagine dei QR. Massimo ${formatBytes(max_file_bytes)} per file.`}
    >
      <div className="stack">
        <UsageMeter
          label="Spazio utilizzato (tutte le aziende)"
          usage={{
            used,
            limit,
            over_limit: limit !== null && used > limit,
            can_create: limit === null || used < limit,
          }}
          format={formatBytes}
        />
        {data.files.length === 0 ? (
          <p className="muted">Nessun file caricato. I file si caricano dalla creazione dei QR.</p>
        ) : (
          <ul className={styles.list}>
            {data.files.map((file) => (
              <li key={file.id}>
                {file.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.urls.thumb} alt="" width={40} height={40} loading="lazy" />
                ) : file.kind === "pdf" ? (
                  <FileText size={22} aria-hidden="true" />
                ) : (
                  <FileAudio size={22} aria-hidden="true" />
                )}
                <span className={styles.name}>{file.original_name}</span>
                <span className={styles.size}>{formatBytes(file.size_bytes)}</span>
                <IconButton
                  label={`Elimina ${file.original_name}`}
                  tone="danger"
                  onClick={() => remove(file)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
