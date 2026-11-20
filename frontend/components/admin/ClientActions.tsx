"use client";
import { Archive, KeyRound, LogOut, Mail, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { ClientDetailData } from "@/lib/admin-clients";
import { formatDate } from "@/lib/format";
import { EditClientDialog } from "./EditClientDialog";

/** Everything an admin can do to the customer itself: edit, reset access, archive, restore. */
export function ClientActions({
  client,
  onChanged,
  onArchived,
}: {
  client: ClientDetailData;
  onChanged: (client: ClientDetailData) => void;
  onArchived: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const archived = client.deleted_at !== null;
  const base = `admin/clients/${client.id}`;

  async function run(key: string, path: string, ok: string, after?: () => void) {
    setBusy(key);
    try {
      const result = await api<ClientDetailData | undefined>(`${base}${path}`, "POST");
      toast.show(ok);
      if (result && "id" in result) onChanged(result);
      after?.();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function archive() {
    setBusy("archive");
    try {
      await api(base, "DELETE", { confirm_name: confirm });
      toast.show("Cliente archiviato.");
      setArchiving(false);
      onArchived();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  if (archived)
    return (
      <Card
        title="Cliente archiviato"
        description={`Non può accedere e i suoi QR mostrano «QR non attivo». Si può ripristinare fino al ${formatDate(client.purge_after ?? client.deleted_at!)}; dopo, i dati personali vengono cancellati.`}
      >
        <Button
          icon={<RotateCcw size={16} />}
          loading={busy === "restore"}
          onClick={() => run("restore", "/restore", "Cliente ripristinato.")}
        >
          Ripristina cliente
        </Button>
      </Card>
    );

  return (
    <Card
      title="Gestione cliente"
      description="Modifica i dati, reimposta l’accesso oppure archivia il cliente."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
          Modifica dati
        </Button>
        {client.invited ? (
          <Button
            variant="secondary"
            icon={<Mail size={16} />}
            loading={busy === "invite"}
            onClick={() =>
              run("invite", "/resend-invite", `Invito reinviato a ${client.owner.email}.`)
            }
          >
            Reinvia l’invito
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon={<KeyRound size={16} />}
            loading={busy === "reset"}
            onClick={() =>
              run("reset", "/reset-password", `Email di reset inviata a ${client.owner.email}.`)
            }
          >
            Reimposta la password
          </Button>
        )}
        <Button
          variant="secondary"
          icon={<LogOut size={16} />}
          loading={busy === "logout"}
          onClick={() => run("logout", "/revoke-sessions", "Sessioni chiuse.")}
        >
          Disconnetti ovunque
        </Button>
        <Button variant="danger" icon={<Archive size={16} />} onClick={() => setArchiving(true)}>
          Elimina cliente
        </Button>
      </div>

      {editing && (
        <EditClientDialog
          open
          client={client}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onChanged(saved);
          }}
        />
      )}
      <Modal
        open={archiving}
        title="Eliminare il cliente?"
        onClose={() => setArchiving(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setArchiving(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={busy === "archive"}
              disabled={confirm.trim() !== client.name}
              onClick={archive}
            >
              Elimina
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>
            Il cliente viene <strong>archiviato per 30 giorni</strong>: non può più accedere,
            l’abbonamento Stripe viene annullato e i suoi QR mostrano «QR non attivo» (gli indirizzi
            non vengono mai riassegnati). Entro 30 giorni puoi ripristinarlo; poi i dati personali,
            i file e le statistiche vengono cancellati.
          </p>
          <Input
            label={`Per confermare scrivi: ${client.name}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </Modal>
    </Card>
  );
}
