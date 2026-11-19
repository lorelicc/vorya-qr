"use client";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Card, Input, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { useDebouncedValue } from "@/lib/hooks";
import type { AccountPlan, QrCode } from "@/lib/types";
import styles from "./links.module.css";

type Alias = { id: number; alias: string; url: string };

/** Custom back-halves: extra names for the link; the original slug never stops working. */
export function AliasesCard({ qr, plan }: { qr: QrCode; plan: AccountPlan | null }) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [value, setValue] = useState("");
  const debounced = useDebouncedValue(value.trim().toLowerCase());
  const [check, setCheck] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Alias | null>(null);
  const allowed = plan?.features.custom_back_half ?? true;

  const load = useCallback(() => {
    api<Alias[]>(`${base}/qr-codes/${qr.id}/aliases`)
      .then(setAliases)
      .catch(() => undefined);
  }, [base, qr.id]);
  useEffect(load, [load]);

  useEffect(() => {
    if (!debounced) return;
    let alive = true;
    api<{ available: boolean; reason: string | null }>(
      `${base}/qr-codes/aliases/check?alias=${encodeURIComponent(debounced)}`,
    )
      .then((r) => alive && setCheck(r))
      .catch(() => alive && setCheck(null));
    return () => {
      alive = false;
    };
  }, [base, debounced]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`${base}/qr-codes/${qr.id}/aliases`, "POST", { alias: value });
      toast.show("Back-half aggiunto.");
      setValue("");
      setCheck(null);
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`${base}/qr-codes/${qr.id}/aliases/${removing.id}?confirm=true`, "DELETE");
      toast.show("Back-half rimosso.");
      setRemoving(null);
      load();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const status = value.trim() && check && debounced === value.trim().toLowerCase() ? check : null;
  return (
    <Card
      title="Back-half personalizzato"
      description="Un indirizzo più facile da ricordare. Il link originale continua a funzionare: i QR già stampati non cambiano."
    >
      {!allowed ? (
        <p className={styles.locked}>
          <Lock size={14} aria-hidden="true" /> Back-half personalizzato: disponibile nel piano Pro.
        </p>
      ) : (
        <div className="stack">
          <ul className={styles.aliases}>
            <li>
              <code>{qr.root_url}</code> <span className="muted">originale</span>
            </li>
            {aliases.map((a) => (
              <li key={a.id}>
                <code>{a.url}</code>
                <button
                  type="button"
                  aria-label={`Rimuovi ${a.alias}`}
                  title="Rimuovi"
                  onClick={() => setRemoving(a)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={add} className={styles.aliasForm}>
            <Input
              label="Nuovo back-half"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={50}
              placeholder="vendemmia2026"
              hint="Da 3 a 50 caratteri: lettere minuscole, numeri e trattini."
              error={status && !status.available ? (status.reason ?? undefined) : undefined}
            />
            <Button
              type="submit"
              icon={<Plus size={16} />}
              loading={busy}
              disabled={!value.trim() || (status !== null && !status.available)}
            >
              Aggiungi
            </Button>
          </form>
          {status?.available && <p className={styles.ok}>Disponibile.</p>}
        </div>
      )}
      <Modal
        open={removing !== null}
        title="Rimuovere questo back-half?"
        onClose={() => setRemoving(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Annulla
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              Rimuovi
            </Button>
          </>
        }
      >
        <p>
          Chi usa <strong>{removing?.url}</strong> (link condivisi o QR stampati con questo
          indirizzo) non raggiungerà più la destinazione. Per 90 giorni l’indirizzo non potrà essere
          assegnato ad altri account.
        </p>
      </Modal>
    </Card>
  );
}
