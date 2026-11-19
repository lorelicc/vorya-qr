"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { Notice } from "./Notice";
import styles from "./forms.module.css";

type Props = {
  endpoint: "auth/verify-email" | "auth/reset-password";
  submitLabel: string;
  successHref: string;
  missingLinkHref: string;
};

/** Reads the one-time token from the URL fragment (never sent to servers or logs). */
export function SetPasswordForm({ endpoint, submitLabel, successHref, missingLinkHref }: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});

  useEffect(() => {
    const value = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fragment only exists in the browser
    setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : "");
    if (value) history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setFields({});
    try {
      await api(endpoint, "POST", {
        token,
        password: form.get("password"),
        confirm_password: form.get("confirm_password"),
      });
      router.replace(successHref);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setFields(fieldErrors(err));
      setBusy(false);
    }
  }

  if (token === null) return <p className={styles.alt}>Verifica del link in corso…</p>;
  if (!token)
    return (
      <Notice tone="error">
        Link non valido o incompleto. <Link href={missingLinkHref}>Richiedine uno nuovo</Link>.
      </Notice>
    );

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Input
        label="Nuova password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        hint="Almeno 12 caratteri."
        error={fields.password}
      />
      <Input
        label="Ripeti la password"
        name="confirm_password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        error={fields.confirm_password}
      />
      <Button type="submit" loading={busy} block>
        {submitLabel}
      </Button>
    </form>
  );
}
