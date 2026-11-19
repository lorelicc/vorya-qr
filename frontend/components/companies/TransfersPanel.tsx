"use client";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Transfer as TransferArt } from "@/components/illustrations";
import { Badge, Button, Card, Modal, useToast, type BadgeTone } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Transfer, TransferStatus } from "@/lib/types";
import styles from "./Companies.module.css";

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "In attesa", tone: "warning" },
  accepted: { label: "Accettato", tone: "success" },
  declined: { label: "Rifiutato", tone: "danger" },
  cancelled: { label: "Annullato", tone: "neutral" },
  expired: { label: "Scaduto", tone: "neutral" },
};

type Props = {
  incoming: Transfer[];
  outgoing: Transfer[];
  highlight?: number;
  onChange: () => void;
};

export function TransfersPanel({ incoming, outgoing, highlight, onChange }: Props) {
  const toast = useToast();
  const [result, setResult] = useState<{ state: "accepted" | "declined"; text: string } | null>(
    null,
  );
  const pendingIn = incoming.filter((t) => t.status === "pending");
  const pendingOut = outgoing.filter((t) => t.status === "pending");
  const outcome = (
    <Modal
      open={result !== null}
      title={result?.state === "accepted" ? "Trasferimento completato" : "Richiesta rifiutata"}
      onClose={() => setResult(null)}
      actions={<Button onClick={() => setResult(null)}>Chiudi</Button>}
    >
      <div className={styles.outcome}>
        {result && <TransferArt state={result.state} />}
        <p>{result?.text}</p>
      </div>
    </Modal>
  );
  if (!pendingIn.length && !pendingOut.length) return outcome;

  async function act(t: Transfer, action: "accept" | "decline" | "cancel") {
    try {
      await api(`company-transfers/${t.id}/${action}`, "POST");
      if (action === "accept")
        setResult({
          state: "accepted",
          text: `«${t.company.name}» è ora nel tuo account, con QR, file e statistiche. I QR continuano a funzionare.`,
        });
      else if (action === "decline")
        setResult({ state: "declined", text: `«${t.company.name}» resta a ${t.from.name}.` });
      else toast.show("Richiesta annullata.");
      onChange();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <>
      <Card
        title="Trasferimenti"
        description="Le aziende si spostano con i loro QR, file e statistiche. I QR continuano a funzionare."
      >
        <ul className={styles.transfers}>
          {pendingIn.map((t) => (
            <li key={t.id} data-highlight={t.id === highlight || undefined}>
              <ArrowLeftRight size={18} aria-hidden="true" />
              <div>
                <strong>{t.from.name}</strong> vuole trasferirti <strong>«{t.company.name}»</strong>
                <small>Scade il {formatDate(t.expires_at)}</small>
                {t.failure_reason && <small className={styles.failure}>{t.failure_reason}</small>}
              </div>
              <div className={styles.transferActions}>
                <Button variant="secondary" onClick={() => act(t, "decline")}>
                  Rifiuta
                </Button>
                <Button onClick={() => act(t, "accept")}>Accetta</Button>
              </div>
            </li>
          ))}
          {pendingOut.map((t) => (
            <li key={t.id}>
              <ArrowLeftRight size={18} aria-hidden="true" />
              <div>
                <strong>«{t.company.name}»</strong> → {t.to_email}
                <small>
                  <Badge tone={TRANSFER_STATUS[t.status].tone}>
                    {TRANSFER_STATUS[t.status].label}
                  </Badge>{" "}
                  scade il {formatDate(t.expires_at)}
                </small>
              </div>
              <div className={styles.transferActions}>
                <Button variant="ghost" onClick={() => act(t, "cancel")}>
                  Annulla richiesta
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.pendingArt}>
          <TransferArt state="pending" />
        </div>
      </Card>
      {outcome}
    </>
  );
}
