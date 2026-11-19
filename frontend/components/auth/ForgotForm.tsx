"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { Notice } from "./Notice";
import styles from "./forms.module.css";

export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>("auth/forgot-password", "POST", {
        email: new FormData(event.currentTarget).get("email"),
      });
      setMessage(result.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Button type="submit" loading={busy} block>
        Invia il link
      </Button>
      <p className={styles.alt}>
        <Link href="/login">Torna all’accesso</Link>
      </p>
    </form>
  );
}
