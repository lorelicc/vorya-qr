"use client";
import { useState, type FormEvent } from "react";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { ClientDetailData } from "@/lib/admin-clients";

type Profile = NonNullable<ClientDetailData["profile"]>;
const EMPTY: Profile = {
  legal_name: "", vat: "", tax_code: "", address: "", zip: "", city: "", province: "",
  country: "IT", sdi_code: "", pec: "",
}; // prettier-ignore

/** Edit the customer's name, email and billing data (written to the audit trail). */
export function EditClientDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client: ClientDetailData;
  onClose: () => void;
  onSaved: (client: ClientDetailData) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(client.name);
  const [owner, setOwner] = useState(client.owner.display_name);
  const [email, setEmail] = useState(client.owner.email);
  const [withProfile, setWithProfile] = useState(Boolean(client.profile));
  const [profile, setProfile] = useState<Profile>(client.profile ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const field = (key: keyof Profile, label: string, extra: Partial<{ hint: string }> = {}) => (
    <Input
      label={label}
      value={profile[key]}
      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
      {...extra}
    />
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await api<ClientDetailData>(`admin/clients/${client.id}`, "PATCH", {
        workspace_name: name,
        display_name: owner,
        email,
        ...(withProfile ? { profile } : {}),
      });
      toast.show("Dati salvati.");
      onSaved(saved);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Modifica cliente"
      size="md"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" form="edit-client" loading={busy}>
            Salva
          </Button>
        </>
      }
    >
      <form id="edit-client" onSubmit={submit} className="stack">
        <Input label="Nome dell’attività" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Nome e cognome" value={owner} onChange={(e) => setOwner(e.target.value)} />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Cambiarla cambia l’indirizzo con cui il cliente accede."
        />
        <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={withProfile}
            onChange={(e) => setWithProfile(e.target.checked)}
          />
          Modifica i dati di fatturazione
        </label>
        {withProfile && (
          <>
            {field("legal_name", "Intestatario")}
            {field("vat", "Partita IVA")}
            {field("tax_code", "Codice fiscale")}
            {field("address", "Indirizzo")}
            {field("zip", "CAP")}
            {field("city", "Città")}
            {field("province", "Provincia (sigla)")}
            {field("country", "Paese (2 lettere)")}
            {field("sdi_code", "Codice SDI")}
            {field("pec", "PEC")}
          </>
        )}
      </form>
    </Modal>
  );
}
