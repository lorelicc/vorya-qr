"use client";
import { useState } from "react";
import { GiftMonths, GiftPlan } from "@/components/illustrations";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { ClientDetailData } from "@/lib/admin-clients";
import type { Plan } from "@/lib/types";
import styles from "./admin.module.css";

const QUICK = [1, 3, 6, 12];

/** Gift a plan for N months. Stacks on a running gift; the customer gets an email. */
export function GrantDialog({
  open,
  clientId,
  plans,
  defaultPlan,
  onClose,
  onDone,
}: {
  open: boolean;
  clientId: number;
  plans: Plan[];
  defaultPlan: string;
  onClose: () => void;
  onDone: (detail: ClientDetailData) => void;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState(defaultPlan);
  const [months, setMonths] = useState(3);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const detail = await api<ClientDetailData>(`admin/clients/${clientId}/grants`, "POST", {
        plan_id: plan,
        months,
        note,
      });
      toast.show("Omaggio attivato: il cliente riceve una email.");
      onDone(detail);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Regala un piano"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button loading={busy} onClick={submit} disabled={months < 1 || months > 36}>
            Regala {months} {months === 1 ? "mese" : "mesi"}
          </Button>
        </>
      }
    >
      <div className={styles.giftArt}>{months >= 3 ? <GiftPlan /> : <GiftMonths />}</div>
      <div className="stack">
        <Select label="Piano" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <div>
          <div className={styles.chips} role="group" aria-label="Durata rapida">
            {QUICK.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={months === m}
                onClick={() => setMonths(m)}
              >
                {m} {m === 1 ? "mese" : "mesi"}
              </button>
            ))}
          </div>
          <Input
            label="Mesi (1–36)"
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          />
        </div>
        <Input
          label="Nota interna"
          value={note}
          maxLength={300}
          placeholder="Es. cliente storico, rimborso, collaborazione"
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="muted">
          L’omaggio non genera addebiti. Se il cliente ha già un omaggio in corso, i mesi si
          sommano. Alla fine torna alle regole di una prova scaduta (QR attivi ancora per un
          periodo).
        </p>
      </div>
    </Modal>
  );
}
