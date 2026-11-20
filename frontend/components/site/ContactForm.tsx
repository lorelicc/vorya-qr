"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Notice } from "@/components/auth/Notice";
import { Button, Input } from "@/components/ui";
import { PublicApiError, publicPost } from "@/lib/site/public-api";
import styles from "./contact.module.css";

/** Contact form: honeypot, rate limit and delivery to the support address are server side. */
export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await publicPost<{ message: string }>("public/contact", {
        name: form.get("name"),
        email: form.get("email"),
        message: form.get("message"),
        accept_privacy: form.get("accept_privacy") === "on",
        hp: form.get("website_url") ?? "",
      });
      setDone(result.message);
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : "Invio non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Notice tone="success">{done}</Notice>;
  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <Notice tone="error">{error}</Notice>}
      <Input label="Nome e cognome" name="name" autoComplete="name" required minLength={2} />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <label className={styles.area}>
        <span>Messaggio</span>
        <textarea name="message" rows={6} required minLength={10} maxLength={3000} />
      </label>
      <input
        className={styles.trap}
        name="website_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label className={styles.check}>
        <input type="checkbox" name="accept_privacy" required />
        <span>
          Ho letto l’<Link href="/legal/privacy">Informativa privacy</Link>.
        </span>
      </label>
      <Button type="submit" loading={busy}>
        Invia il messaggio
      </Button>
    </form>
  );
}
