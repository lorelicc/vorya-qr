"use client";
import { useState, type FormEvent } from "react";
import { Notice } from "@/components/auth/Notice";
import { Button, Input } from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";

/** Sets a 24 h unlock cookie, then reloads the same short URL (now served normally). */
export function UnlockForm({ slug }: { slug: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`public/links/${slug}/unlock`, "POST", { password });
      window.location.reload();
    } catch (err) {
      setError(fieldErrors(err).password ?? errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ marginTop: "var(--space-4)" }}>
      {error && <Notice tone="error">{error}</Notice>}
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoFocus
      />
      <Button type="submit" loading={busy} block>
        Apri il link
      </Button>
    </form>
  );
}
