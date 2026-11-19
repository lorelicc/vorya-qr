"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Input, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";

export function DeleteCompany() {
  const { company } = useCompany();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await fetchDelete();
      toast.show(`«${company.name}» eliminata. Puoi ripristinarla entro 30 giorni.`);
      router.push("/companies");
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(false);
    }
  }

  const fetchDelete = () => api(`companies/${company.id}`, "DELETE", { confirm_name: confirm });

  return (
    <Card
      title="Elimina azienda"
      description="L’azienda e i suoi QR si possono recuperare per 30 giorni; poi contenuti, file e statistiche vengono cancellati."
    >
      <Button variant="danger" onClick={() => setOpen(true)}>
        Elimina azienda
      </Button>
      <Modal
        open={open}
        title="Eliminare l’azienda?"
        onClose={() => setOpen(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={confirm.trim() !== company.name}
              onClick={remove}
            >
              Elimina
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>
            Tutti i QR dinamici di «{company.name}» mostreranno subito la pagina “QR non attivo”,
            anche quelli già stampati. Puoi ripristinare l’azienda entro 30 giorni.
          </p>
          <Input
            label={`Digita «${company.name}» per confermare`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </div>
      </Modal>
    </Card>
  );
}
