"use client";
import { useState, type FormEvent } from "react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { ClientDetailData } from "@/lib/admin-clients";
import type { Plan } from "@/lib/types";

/** Add a client: the customer gets an email to choose the password (valid 7 days). */
export function NewClientDialog({
  open,
  plans,
  onClose,
  onCreated,
}: {
  open: boolean;
  plans: Plan[];
  onClose: () => void;
  onCreated: (client: ClientDetailData) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    display_name: "",
    email: "",
    workspace_name: "",
    plan_id: "",
    trial_days: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await api<ClientDetailData>("admin/clients", "POST", {
        display_name: form.display_name,
        email: form.email,
        workspace_name: form.workspace_name,
        ...(form.plan_id ? { plan_id: form.plan_id } : {}),
        ...(form.trial_days !== "" ? { trial_days: Number(form.trial_days) } : {}),
      });
      toast.show(`Invito inviato a ${created.owner.email}.`);
      setForm({ display_name: "", email: "", workspace_name: "", plan_id: "", trial_days: "" });
      onCreated(created);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Nuovo cliente"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" form="new-client" loading={busy}>
            Crea e invita
          </Button>
        </>
      }
    >
      <form id="new-client" onSubmit={submit} className="stack">
        <p className="muted">
          Il cliente riceve una email con il link per scegliere la password. Fino ad allora non può
          accedere.
        </p>
        <Input
          label="Nome e cognome"
          value={form.display_name}
          onChange={(e) => set({ display_name: e.target.value })}
          required
          minLength={2}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
          required
        />
        <Input
          label="Nome dell’attività"
          value={form.workspace_name}
          onChange={(e) => set({ workspace_name: e.target.value })}
          required
          minLength={2}
        />
        <Select
          label="Piano"
          value={form.plan_id}
          onChange={(e) => set({ plan_id: e.target.value })}
          hint="Vuoto = il piano di prova predefinito."
        >
          <option value="">Predefinito</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input
          label="Giorni di prova"
          type="number"
          min={0}
          max={365}
          value={form.trial_days}
          onChange={(e) => set({ trial_days: e.target.value })}
          hint="Vuoto = quelli predefiniti. 0 = piano assegnato senza scadenza. La prova parte al primo accesso."
        />
      </form>
    </Modal>
  );
}
