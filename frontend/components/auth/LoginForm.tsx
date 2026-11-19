"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Input } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Notice } from "./Notice";
import styles from "./forms.module.css";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const me = await api<Me>("auth/login", "POST", {
        email: form.get("email"),
        password: form.get("password"),
        remember: form.get("remember") === "on",
      });
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safeNext ?? (me.role === "company_admin" ? "/app" : "/admin"));
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <div className={styles.between}>
        <label className={styles.check}>
          <input type="checkbox" name="remember" /> Ricordami per 30 giorni
        </label>
        <Link href="/forgot-password">Password dimenticata?</Link>
      </div>
      <Button type="submit" loading={busy} block>
        Accedi
      </Button>
      <p className={styles.alt}>
        Non hai un account? <Link href="/register">Prova gratis per 14 giorni</Link>
      </p>
    </form>
  );
}
