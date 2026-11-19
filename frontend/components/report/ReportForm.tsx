"use client";
import { useState, type FormEvent } from "react";
import { Notice } from "@/components/auth/Notice";
import styles from "@/components/auth/forms.module.css";
import { Button, Field, Input, Select, fieldStyles } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

const REASONS = [
  ["phishing", "Phishing: chiede password o dati personali"],
  ["malware", "Scarica virus o app sospette"],
  ["spam", "Spam o truffa"],
  ["illegal", "Contenuti illegali"],
  ["other", "Altro"],
] as const;

/** Public abuse report. No account needed; rate limited by the backend. */
export function ReportForm({ initialLink = "" }: { initialLink?: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ detail: string }>("public/reports", "POST", {
        link: form.get("link"),
        reason: form.get("reason"),
        details: form.get("details"),
        email: String(form.get("email") ?? "").trim() || null,
        website: form.get("website") ?? "",
      });
      setSent(result.detail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <Notice tone="success">{sent}</Notice>;
  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <Notice tone="error">{error}</Notice>}
      <Input
        label="Link del QR"
        name="link"
        required
        defaultValue={initialLink}
        placeholder="https://qr.vorya.it/r/Ab3dEf7"
        hint="Lo trovi nella barra degli indirizzi dopo aver scansionato il QR."
      />
      <Select label="Motivo" name="reason" required defaultValue="phishing">
        {REASONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Field id="report-details" label="Dettagli (facoltativo)">
        <textarea
          id="report-details"
          name="details"
          rows={4}
          maxLength={2000}
          className={fieldStyles.control}
        />
      </Field>
      <Input
        label="La tua email (facoltativa)"
        name="email"
        type="email"
        autoComplete="email"
        hint="Solo se vuoi essere ricontattato."
      />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
        <label>
          Sito web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Button type="submit" loading={busy} block>
        Invia la segnalazione
      </Button>
    </form>
  );
}
