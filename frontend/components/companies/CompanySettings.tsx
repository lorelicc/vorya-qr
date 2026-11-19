"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ColorField } from "@/components/qr/ColorField";
import { Button, Card, Input, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { Company } from "@/lib/types";
import { Dropzone } from "@/components/files/Dropzone";
import { FilesPanel } from "@/components/files/FilesPanel";
import { CompanyAvatar } from "@/components/layout/CompanyAvatar";
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
  const [logo, setLogo] = useState(company.logo_url);

  async function removeLogo() {
    await api(`companies/${company.id}/logo`, "DELETE").catch(() => undefined);
    setLogo(null);
    router.refresh();
  }

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
          <div className={styles.logoRow}>
            <CompanyAvatar company={{ name, logo_url: logo, primary_color: primary }} size={64} />
            <Dropzone<{ logo_url: string }>
              compact
              path={`companies/${company.id}/logo`}
              purpose="logo"
              label={logo ? "Sostituisci il logo" : "Carica il logo"}
              hint="PNG, JPG o WebP. Niente SVG."
              onUploaded={(result) => {
                setLogo(result.logo_url);
                toast.show("Logo aggiornato.");
                router.refresh();
              }}
            />
            {logo && (
              <Button variant="ghost" onClick={removeLogo}>
                Rimuovi
              </Button>
            )}
          </div>
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
      <FilesPanel />
      <TransferCompany />
      <DeleteCompany />
    </div>
  );
}
