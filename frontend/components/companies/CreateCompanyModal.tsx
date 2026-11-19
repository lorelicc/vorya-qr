"use client";
import { useState, type FormEvent } from "react";
import { ColorField } from "@/components/qr/ColorField";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import type { Company } from "@/lib/types";
import styles from "./Companies.module.css";

export function CreateCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (company: Company) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [primary, setPrimary] = useState("#087f5b");
  const [secondary, setSecondary] = useState("#00e99a");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const company = await api<Company>("companies", "POST", {
        name,
        sector: sector || null,
        primary_color: primary,
        secondary_color: secondary,
      });
      toast.show(`Azienda «${company.name}» creata.`);
      setName("");
      setSector("");
      onCreated(company);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Nuova azienda" onClose={onClose} size="md">
      <form className="stack" onSubmit={submit} noValidate>
        <Input
          label="Nome dell’azienda"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          error={errors.name}
        />
        <Input
          label="Settore (facoltativo)"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          maxLength={80}
          placeholder="Es. Ristorazione"
        />
        <div className={styles.colors}>
          <ColorField label="Colore primario" value={primary} onChange={setPrimary} />
          <ColorField label="Colore secondario" value={secondary} onChange={setSecondary} />
        </div>
        <p className="muted">
          I colori diventano lo stile predefinito dei nuovi QR e delle pagine dell’azienda. Il logo
          si carica dalle impostazioni.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" loading={busy}>
            Crea azienda
          </Button>
        </div>
      </form>
    </Modal>
  );
}
