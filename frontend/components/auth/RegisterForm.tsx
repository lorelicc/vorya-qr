"use client";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { clearHandoff, readAttribution, readHandoff } from "@/lib/site/attribution";
import { adsConversion } from "@/components/site/ConsentBanner";
import { trackEvent } from "@/lib/site/public-api";
import { Notice } from "./Notice";
import styles from "./forms.module.css";

const noop = () => () => undefined;

export function RegisterForm() {
  // A QR started in the free generator is turned into a dynamic one after the email check.
  const hasHandoff = useSyncExternalStore(
    noop,
    () => readHandoff() !== null,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [sent, setSent] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setFields({});
    try {
      const result = await api<{ message: string }>("auth/register", "POST", {
        display_name: form.get("display_name"),
        workspace_name: form.get("workspace_name"),
        email: form.get("email"),
        accept_terms: form.get("accept_terms") === "on",
        attribution: readAttribution() ?? undefined,
        handoff: readHandoff() ?? undefined,
      });
      trackEvent("registrazione-inviata");
      adsConversion();
      clearHandoff();
      setSent(result.message);
    } catch (err) {
      setError(errorMessage(err));
      setFields(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <div className={styles.form}>
        <Notice tone="success">{sent}</Notice>
        <p className={styles.alt}>
          Non trovi l’email? Controlla lo spam o <Link href="/register">riprova</Link>.
        </p>
      </div>
    );

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {hasHandoff && (
        <Notice tone="success">
          Dopo la conferma dell’email troverai già il tuo QR dinamico, con lo stesso stile.
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Input
        label="Nome e cognome"
        name="display_name"
        autoComplete="name"
        required
        error={fields.display_name}
      />
      <Input
        label="Azienda o progetto"
        name="workspace_name"
        autoComplete="organization"
        required
        error={fields.workspace_name}
      />
      <Input
        label="Email di lavoro"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={fields.email}
      />
      <label className={styles.check}>
        <input type="checkbox" name="accept_terms" required />
        <span>
          Accetto i <Link href="/legal/termini">Termini di servizio</Link> e ho letto l’
          <Link href="/legal/privacy">Informativa privacy</Link>.
        </span>
      </label>
      {fields.accept_terms && <p className={styles.fieldError}>{fields.accept_terms}</p>}
      <Button type="submit" loading={busy} block>
        Continua con l’email
      </Button>
      <p className={styles.alt}>
        Hai già un account? <Link href="/login">Accedi</Link>
      </p>
    </form>
  );
}
