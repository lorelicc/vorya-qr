"use client";
import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import type { BillingProfile } from "@/lib/billing";
import { clean, validTaxCode, validVat } from "@/lib/fiscal";
import styles from "./billing.module.css";

export const EMPTY_PROFILE: BillingProfile = {
  legal_name: "",
  vat: "",
  tax_code: "",
  address: "",
  zip: "",
  city: "",
  province: "",
  country: "IT",
  sdi_code: "",
  pec: "",
};

/** Client-side mirror of the backend rules, for fast feedback; the server has the last word. */
export function validateProfile(p: BillingProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  const italy = p.country === "IT";
  const vat = clean(p.vat).replace(/^IT(?=\d{11}$)/, "");
  const cf = clean(p.tax_code);
  if (p.legal_name.trim().length < 2) errors.legal_name = "Indica la ragione sociale o il nome.";
  if (!vat && !cf) errors.vat = "Indica la partita IVA e/o il codice fiscale.";
  if (italy && vat && !validVat(vat)) errors.vat = "Partita IVA non valida.";
  if (italy && cf && !validTaxCode(cf)) errors.tax_code = "Codice fiscale non valido.";
  if (p.address.trim().length < 3) errors.address = "Indica l’indirizzo.";
  if (italy && !/^\d{5}$/.test(p.zip.trim())) errors.zip = "CAP non valido (5 cifre).";
  if (p.city.trim().length < 2) errors.city = "Indica il comune.";
  if (italy && !/^[A-Za-z]{2}$/.test(p.province.trim()))
    errors.province = "Sigla provincia (es. MI).";
  if (italy && !p.sdi_code.trim() && !p.pec.trim())
    errors.sdi_code = "Indica il codice SDI e/o la PEC.";
  if (p.sdi_code.trim() && !/^[A-Za-z0-9]{7}$/.test(p.sdi_code.trim()))
    errors.sdi_code = "Il codice SDI ha 7 caratteri.";
  if (p.pec.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(p.pec.trim()))
    errors.pec = "PEC non valida.";
  return errors;
}

export function BillingProfileForm({
  initial,
  submitLabel = "Salva i dati",
  onSaved,
}: {
  initial: BillingProfile | null;
  submitLabel?: string;
  onSaved: (profile: BillingProfile) => void | Promise<void>;
}) {
  const [value, setValue] = useState<BillingProfile>(initial ?? EMPTY_PROFILE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof BillingProfile) => (e: { target: { value: string } }) =>
    setValue((v) => ({ ...v, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateProfile(value);
    setErrors(local);
    setFormError("");
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const saved = await api<BillingProfile>("account/billing/profile", "PUT", value);
      await onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className={styles.form}>
        <div className={styles.wide}>
          <Input
            label="Ragione sociale o nome e cognome"
            value={value.legal_name}
            onChange={set("legal_name")}
            error={errors.legal_name}
            autoComplete="organization"
          />
        </div>
        <Input
          label="Partita IVA"
          value={value.vat}
          onChange={set("vat")}
          error={errors.vat}
          inputMode="numeric"
          hint="Facoltativa se indichi il codice fiscale."
        />
        <Input
          label="Codice fiscale"
          value={value.tax_code}
          onChange={set("tax_code")}
          error={errors.tax_code}
        />
        <div className={styles.wide}>
          <Input
            label="Indirizzo"
            value={value.address}
            onChange={set("address")}
            error={errors.address}
            autoComplete="street-address"
          />
        </div>
        <Input
          label="CAP"
          value={value.zip}
          onChange={set("zip")}
          error={errors.zip}
          autoComplete="postal-code"
        />
        <Input label="Comune" value={value.city} onChange={set("city")} error={errors.city} />
        <Input
          label="Provincia"
          value={value.province}
          onChange={set("province")}
          error={errors.province}
          maxLength={3}
        />
        <Select label="Paese" value={value.country} onChange={set("country")}>
          <option value="IT">Italia</option>
          <option value="DE">Germania</option>
          <option value="FR">Francia</option>
          <option value="ES">Spagna</option>
          <option value="AT">Austria</option>
          <option value="CH">Svizzera</option>
          <option value="GB">Regno Unito</option>
        </Select>
        <Input
          label="Codice SDI"
          value={value.sdi_code}
          onChange={set("sdi_code")}
          error={errors.sdi_code}
          maxLength={7}
          hint="7 caratteri. In alternativa la PEC."
        />
        <Input
          label="PEC"
          value={value.pec}
          onChange={set("pec")}
          error={errors.pec}
          type="email"
        />
      </div>
      <p className={styles.hint}>
        Usiamo questi dati per la fattura, che viene emessa fuori da Vorya QR dopo il pagamento.
      </p>
      {formError && !Object.keys(errors).length && <p role="alert">{formError}</p>}
      <div className={styles.row} style={{ marginTop: "var(--space-4)" }}>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
