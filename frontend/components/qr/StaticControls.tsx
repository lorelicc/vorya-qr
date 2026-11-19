"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { QrCode } from "@/lib/types";

export function StaticControls({ qr }: { qr: QrCode }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api(`qr-codes/${qr.id}`, "DELETE");
      router.push("/app");
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(false);
    }
  }

  return (
    <Card
      title="QR statico"
      description="Funziona per sempre, anche senza Vorya QR: l’URL è dentro il codice."
    >
      <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setOpen(true)}>
        Elimina dalla lista
      </Button>
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
