"use client";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImportArt } from "@/components/illustrations";
import { Button, ButtonLink, Card, Select, buttonClass, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { csrfHeaders } from "@/lib/auth-client";
import { useCompany } from "@/lib/company-context";
import { ImportPreview } from "./ImportPreview";
import styles from "./import.module.css";

export type ImportJob = {
  id: number;
  status: "validated" | "invalid" | "queued" | "running" | "done" | "failed";
  format: string;
  total: number;
  processed: number;
  created: number;
  errors: { row: number; column: string; message: string }[];
  error: string | null;
  has_result: boolean;
  preview: { row: number; cells: Record<string, string> }[] | null;
};

/** Template → upload → row-by-row preview → confirm → real progress → ZIP. */
export function ImportWizard() {
  const { api: base, app } = useCompany();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState("png");
  const [size, setSize] = useState("1024");
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  // Poll the real progress while the worker renders the files.
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      api<ImportJob>(`${base}/imports/${job.id}`)
        .then(setJob)
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [base, job]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("format", format);
      body.append("size", size);
      const response = await fetch(`/api/${base}/imports`, {
        method: "POST",
        headers: csrfHeaders(),
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Caricamento non riuscito.");
      setJob(data);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "confirm" | "retry") {
    if (!job) return;
    setBusy(true);
    try {
      setJob({
        ...(await api<ImportJob>(`${base}/imports/${job.id}/${action}`, "POST")),
        preview: null,
      });
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) upload(file);
  };

  if (job?.status === "validated" || job?.status === "invalid")
    return (
      <ImportPreview
        job={job}
        busy={busy}
        onConfirm={() => act("confirm")}
        onRestart={() => setJob(null)}
      />
    );

  if (job) {
    const percent = job.total ? Math.round((job.processed / job.total) * 100) : 0;
    const state = job.status === "done" ? "done" : job.status === "failed" ? "errors" : "running";
    return (
      <Card>
        <div className={styles.progress} role="status" aria-live="polite">
          <ImportArt state={state} />
          {state === "running" && (
            <>
              <h2>Creo i QR…</h2>
              <div
                className={styles.bar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={job.total}
                aria-valuenow={job.processed}
                aria-label="Avanzamento"
              >
                <span style={{ transform: `scaleX(${percent / 100})` }} />
              </div>
              <p className="muted">
                {job.processed} di {job.total} ({percent}%). Puoi lasciare la pagina: il file resta
                disponibile per 7 giorni.
              </p>
            </>
          )}
          {state === "done" && (
            <>
              <h2>{job.created} elementi creati</h2>
              <p className="muted">
                {job.has_result
                  ? "Lo ZIP contiene un file per QR e il riepilogo CSV con tutti gli URL brevi."
                  : "Link e QR sono nella tua lista."}
              </p>
              <div className={styles.actions}>
                {job.has_result && (
                  <a
                    className={buttonClass({})}
                    href={`/api/${base}/imports/${job.id}/result.zip`}
                    download
                  >
                    <Download size={16} aria-hidden="true" /> Scarica lo ZIP
                  </a>
                )}
                <ButtonLink href={app} variant="secondary">
                  Vai a Link e QR
                </ButtonLink>
              </div>
            </>
          )}
          {state === "errors" && (
            <>
              <h2>Qualcosa non è andato a buon fine</h2>
              <p role="alert">{job.error}</p>
              <p className="muted">
                I {job.created} elementi sono già stati creati: serve solo rigenerare lo ZIP.
              </p>
              <Button loading={busy} onClick={() => act("retry")}>
                Riprova
              </Button>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card
        title="1. Scarica il modello"
        description="Un CSV con le colonne giuste e quattro righe di esempio (link, QR dinamico, vCard, Wi‑Fi). Si apre con Excel."
      >
        <a
          className={buttonClass({ variant: "secondary" })}
          href={`/api/${base}/imports/template.csv`}
          download
        >
          <FileSpreadsheet size={16} aria-hidden="true" /> Scarica il modello CSV
        </a>
      </Card>
      <Card
        title="2. Carica il tuo file"
        description="UTF-8 con o senza BOM; separatore «;» o «,» riconosciuto da solo. Non viene creato nulla finché non confermi."
      >
        <div className="stack">
          <div className={styles.options}>
            <Select
              label="Dopo la creazione"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="png">ZIP con PNG</option>
              <option value="svg">ZIP con SVG</option>
              <option value="pdf">ZIP con PDF</option>
              <option value="none">Solo creare, senza file</option>
            </Select>
            {format === "png" && (
              <Select label="Dimensione PNG" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="512">512 px</option>
                <option value="1024">1024 px</option>
                <option value="2048">2048 px</option>
              </Select>
            )}
          </div>
          <div
            className={styles.drop}
            data-over={over || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <UploadCloud size={28} aria-hidden="true" />
            <p>Trascina qui il CSV</p>
            <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
              Scegli il file
            </Button>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
              aria-label="File CSV"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
