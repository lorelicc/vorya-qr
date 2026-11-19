"use client";
import { ArrowLeftRight } from "lucide-react";
import { Badge, Button, Card, useToast, type BadgeTone } from "@/components/ui";
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
  const pendingIn = incoming.filter((t) => t.status === "pending");
  const pendingOut = outgoing.filter((t) => t.status === "pending");
  if (!pendingIn.length && !pendingOut.length) return null;

  async function act(t: Transfer, action: "accept" | "decline" | "cancel") {
    try {
      await api(`company-transfers/${t.id}/${action}`, "POST");
      toast.show(
        action === "accept"
          ? `«${t.company.name}» è ora nel tuo account.`
          : action === "decline"
            ? "Richiesta rifiutata."
            : "Richiesta annullata.",
      );
      onChange();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
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
    </Card>
  );
}
