"use client";
import { useRouter } from "next/navigation";
import { BarChart3, Copy, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, Card, Modal, useToast } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import { scansLabel } from "@/lib/format";
import type { QrCode } from "@/lib/types";
import styles from "./DynamicControls.module.css";

export function DynamicControls({ qr, onChange }: { qr: QrCode; onChange: (qr: QrCode) => void }) {
  const router = useRouter();
  const { api: base, app } = useCompany();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const paused = qr.status === "paused";

  async function toggle() {
    setBusy(true);
    try {
      const updated = await api<QrCode>(
        `${base}/qr-codes/${qr.id}/${paused ? "resume" : "pause"}`,
        "POST",
      );
      onChange(updated);
      toast.show(
        paused ? "QR riattivato." : "QR in pausa: chi lo scansiona vedrà “QR non attivo”.",
      );
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`${base}/qr-codes/${qr.id}`, "DELETE");
      router.push(app);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(qr.short_url ?? "");
      toast.show("Link breve copiato.");
    } catch {
      toast.show("Copia non riuscita: seleziona il link e copialo a mano.", "error");
    }
  }

  return (
    <Card title="Link dinamico" description={scansLabel(qr.scan_count)}>
      <div className="stack">
        {qr.status === "blocked" && (
          <p role="alert" className={styles.blocked}>
            Questo QR è stato bloccato dal team Vorya ({qr.blocked_reason || "segnalazione"}): chi
            lo scansiona vede “QR non attivo”. Per chiarimenti scrivi al supporto.
          </p>
        )}
        <div className={styles.link}>
          <code>{qr.short_url}</code>
          <Button variant="secondary" icon={<Copy size={16} />} onClick={copy}>
            Copia
          </Button>
        </div>
        <div className={styles.actions}>
          <ButtonLink
            variant="secondary"
            href={`${app}/qr/${qr.id}/stats`}
            icon={<BarChart3 size={16} />}
          >
            Statistiche
          </ButtonLink>
          {qr.status !== "blocked" && (
            <Button
              variant="secondary"
              loading={busy}
              onClick={toggle}
              icon={paused ? <Play size={16} /> : <Pause size={16} />}
            >
              {paused ? "Riattiva" : "Metti in pausa"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setConfirming(true)} icon={<Trash2 size={16} />}>
            Elimina
          </Button>
        </div>
      </div>
      <Modal
        open={confirming}
        title="Eliminare questo QR?"
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Annulla
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              Elimina definitivamente
            </Button>
          </>
        }
      >
        <p>
          «{qr.name}» verrà eliminato. Chi scansiona un QR già stampato vedrà la pagina “QR non
          attivo” e il link breve non verrà più riutilizzato. L’operazione non si può annullare.
        </p>
      </Modal>
    </Card>
  );
}
