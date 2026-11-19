"use client";
import { useRouter } from "next/navigation";
import { CopyPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, Card, Modal, useToast } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import type { QrCode } from "@/lib/types";

export function StaticControls({ qr }: { qr: QrCode }) {
  const router = useRouter();
  const { api: base, app } = useCompany();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <Card
      title="QR statico · non modificabile"
      description="Funziona per sempre, anche senza Vorya QR: il contenuto è dentro il codice, quindi non si può cambiare. Per correggerlo serve un nuovo QR."
    >
      <div className="stack">
        <p className="muted">
          «Duplica e modifica» crea un <strong>nuovo QR</strong> con il contenuto già inserito. I
          codici già stampati o condivisi restano invariati.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <ButtonLink href={`${app}/qr/new?from=${qr.id}`} icon={<CopyPlus size={16} />}>
            Duplica e modifica
          </ButtonLink>
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setOpen(true)}>
            Elimina dalla lista
          </Button>
        </div>
      </div>
      <Modal
        open={open}
        title="Eliminare questo QR?"
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              Elimina
            </Button>
          </>
        }
      >
        <p>
          «{qr.name}» sparirà dalla tua lista. I QR statici già stampati continueranno a funzionare.
        </p>
      </Modal>
    </Card>
  );
}
