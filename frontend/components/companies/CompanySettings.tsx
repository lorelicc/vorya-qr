"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ColorField } from "@/components/qr/ColorField";
import { Button, Card, Input, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { Company } from "@/lib/types";
import { DeleteCompany } from "./DeleteCompany";
import { TransferCompany } from "./TransferCompany";
import styles from "./Companies.module.css";

export function CompanySettings() {
  const { company } = useCompany();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(company.name);
  const [sector, setSector] = useState(company.sector ?? "");
  const [primary, setPrimary] = useState(company.primary_color);
  const [secondary, setSecondary] = useState(company.secondary_color);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api<Company>(`companies/${company.id}`, "PUT", {
        name,
        sector: sector || null,
        primary_color: primary,
        secondary_color: secondary,
      });
      toast.show("Impostazioni salvate.");
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Impostazioni</h1>
          <p>Branding, trasferimento ed eliminazione dell’azienda «{company.name}».</p>
        </div>
      </div>
      <Card
        title="Branding"
        description="Colori predefiniti per i nuovi QR e per le pagine ospitate. Ogni QR può sovrascriverli."
      >
        <form className="stack" onSubmit={save} noValidate>
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            error={errors.name}
          />
          <Input
            label="Settore"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            maxLength={80}
          />
          <div className={styles.colors}>
            <ColorField label="Colore primario" value={primary} onChange={setPrimary} />
            <ColorField label="Colore secondario" value={secondary} onChange={setSecondary} />
          </div>
          <div>
            <Button type="submit" loading={busy}>
              Salva
            </Button>
          </div>
        </form>
      </Card>
      <TransferCompany />
      <DeleteCompany />
    </div>
  );
}
