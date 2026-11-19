"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { AbuseReport } from "@/lib/types";
import styles from "./admin.module.css";

export const REASONS: Record<AbuseReport["reason"], string> = {
  phishing: "Phishing / furto di dati",
  malware: "Malware o virus",
  spam: "Spam o truffa",
  illegal: "Contenuti illegali",
  other: "Altro",
};
const RESOLUTIONS = {
  dismiss: "Archiviata",
  block_qr: "QR bloccato",
  suspend_workspace: "Account sospeso",
} as const;
type Action = keyof typeof RESOLUTIONS;
const QR_STATUS: Record<string, string> = {
  active: "attivo",
  paused: "in pausa",
  blocked: "bloccato",
};
const CONFIRM: Record<Action, string> = {
  dismiss: "Archiviare la segnalazione senza intervenire?",
  block_qr:
    "Bloccare il QR? Chi lo scansiona vedrà “QR non attivo” e il cliente non potrà riattivarlo.",
  suspend_workspace:
    "Sospendere l’intero spazio di lavoro? Tutti i suoi QR dinamici smettono di funzionare.",
};

export function ReportList({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [data, setData] = useState<{ open: number; items: AbuseReport[] } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ report: AbuseReport; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ open: number; items: AbuseReport[] }>(`admin/reports?status=${status}`)
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, [status]);
  useEffect(load, [load]);

  async function resolve() {
    if (!pending) return;
    setBusy(true);
    try {
      await api(`admin/reports/${pending.report.id}/resolve`, "POST", { action: pending.action });
      toast.show(RESOLUTIONS[pending.action] + ".");
      setPending(null);
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function unblock(qrId: number) {
    try {
      await api(`admin/qr-codes/${qrId}/unblock`, "POST");
      toast.show("QR sbloccato.");
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Segnalazioni</h1>
          <p>Segnalazioni di abuso inviate dal modulo pubblico /report.</p>
        </div>
      </div>
      <div className={styles.tabs} role="radiogroup" aria-label="Stato">
        {(["open", "resolved", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={status === value}
            onClick={() => setStatus(value)}
          >
            {value === "open"
              ? `Aperte${data ? ` (${data.open})` : ""}`
              : value === "resolved"
                ? "Risolte"
                : "Tutte"}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {data === null ? (
        <p className="muted">Caricamento…</p>
      ) : data.items.length === 0 ? (
        <EmptyState
          title="Nessuna segnalazione"
          description="Non ci sono segnalazioni in questo elenco."
        />
      ) : (
        <div className="stack">
          {data.items.map((report) => (
            <Card key={report.id}>
              <article className={styles.report}>
                <div className={styles.reportHead}>
                  <Badge tone={report.status === "open" ? "warning" : "neutral"}>
                    {report.status === "open"
                      ? "Aperta"
                      : RESOLUTIONS[report.resolution ?? "dismiss"]}
                  </Badge>
                  <strong>{REASONS[report.reason]}</strong>
                  <span className="muted">{formatDateTime(report.created_at)}</span>
                </div>
                <dl>
                  <dt>Codice</dt>
                  <dd>
                    <code>{report.slug ?? "—"}</code>
                  </dd>
                  <dt>QR</dt>
                  <dd>
                    {report.qr ? (
                      <>
                        {report.qr.name} · {QR_STATUS[report.qr.status] ?? report.qr.status}
                        {report.qr.deleted ? " · eliminato" : ""}
                        {report.qr.target_url && (
                          <>
                            {" · "}
                            <span className={styles.url}>{report.qr.target_url}</span>
                          </>
                        )}
                      </>
                    ) : (
                      "Nessun QR con questo codice"
                    )}
                  </dd>
                  {report.workspace && (
                    <>
                      <dt>Cliente</dt>
                      <dd>
                        <Link href={`/admin/clients/${report.workspace.id}`}>
                          {report.workspace.name}
                        </Link>
                        {report.company ? ` · ${report.company.name}` : ""} ·{" "}
                        {report.workspace.status === "suspended" ? "sospeso" : "attivo"}
                      </dd>
                    </>
                  )}
                  {report.details && (
                    <>
                      <dt>Dettagli</dt>
                      <dd className={styles.details}>{report.details}</dd>
                    </>
                  )}
                  {report.reporter_email && (
                    <>
                      <dt>Contatto</dt>
                      <dd>{report.reporter_email}</dd>
                    </>
                  )}
                </dl>
                {canWrite && (
                  <div className={styles.reportActions}>
                    {report.status === "open" && (
                      <>
                        {report.qr && (
                          <>
                            <Button
                              variant="danger"
                              onClick={() => setPending({ report, action: "block_qr" })}
                            >
                              Blocca il QR
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setPending({ report, action: "suspend_workspace" })}
                            >
                              Sospendi il cliente
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => setPending({ report, action: "dismiss" })}
                        >
                          Archivia
                        </Button>
                      </>
                    )}
                    {report.qr?.status === "blocked" && (
                      <Button variant="secondary" onClick={() => unblock(report.qr!.id)}>
                        Sblocca il QR
                      </Button>
                    )}
                  </div>
                )}
              </article>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={pending !== null}
        title="Confermi?"
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Annulla
            </Button>
            <Button
              variant={pending?.action === "dismiss" ? "primary" : "danger"}
              loading={busy}
              onClick={resolve}
            >
              Conferma
            </Button>
          </>
        }
      >
        <p>{pending ? CONFIRM[pending.action] : ""}</p>
      </Modal>
    </div>
  );
}
