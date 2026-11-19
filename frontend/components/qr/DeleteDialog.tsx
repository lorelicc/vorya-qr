"use client";
import { useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";

/**
 * Confirmation before deleting one or more codes. Deleted codes are not wiped: the address stays
 * reserved and shows the Vorya "QR non attivo" page to whoever scans it.
 */
export function DeleteDialog({
  items,
  onClose,
  onDone,
}: {
  items: QrCode[];
  onClose: () => void;
  onDone: (ids: number[]) => void;
}) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const many = items.length > 1;
  const dynamic = items.filter((q) => q.kind === "dynamic" || q.slug).length;

  async function confirm() {
    setBusy(true);
    try {
      const ids = items.map((q) => q.id);
      await api(`${base}/qr-codes/bulk`, "POST", { ids, action: "delete" });
      toast.show(many ? `${ids.length} elementi eliminati.` : `«${items[0].name}» eliminato.`);
      onDone(ids);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={items.length > 0}
      title={many ? `Eliminare ${items.length} elementi?` : "Eliminare questo codice?"}
      onClose={onClose}
      size="sm"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button variant="danger" loading={busy} onClick={confirm}>
            Elimina
          </Button>
        </>
      }
    >
      <p>
        {many ? "Spariranno" : `«${items[0]?.name}» sparirà`} dall’elenco e non conterà più nel tuo
        piano.
      </p>
      {dynamic > 0 && (
        <p>
          Chi scansiona un link o un QR già pubblicato vedrà la pagina Vorya «QR non attivo». Il
          codice resta registrato e il suo indirizzo non verrà mai assegnato ad altri.
        </p>
      )}
      <p>
        <strong>L’operazione non si può annullare dall’app.</strong>
      </p>
    </Modal>
  );
}
