"use client";
import { Link2, Plus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";
import styles from "./QuickLinkBar.module.css";

/**
 * Paste a URL → short link in one tap, copied to the clipboard. `advanced` (back-half, UTM,
 * rules) opens below once the link exists.
 */
export function QuickLinkBar({
  onCreated,
  advanced,
}: {
  onCreated: (link: QrCode) => void;
  advanced?: (link: QrCode) => ReactNode;
}) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<QrCode | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const target = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      const link = await api<QrCode>(`${base}/links`, "POST", { target_url: target });
      const short = link.root_url ?? link.short_url ?? "";
      let copied = false;
      try {
        await navigator.clipboard.writeText(short);
        copied = true;
      } catch {
        /* clipboard blocked (permissions): the link stays visible below */
      }
      toast.show(copied ? `Link copiato: ${short.replace(/^https?:\/\//, "")}` : "Link creato.");
      setUrl("");
      setLast(link);
      onCreated(link);
    } catch (err) {
      const fields = fieldErrors(err);
      setError(fields.target_url ?? fields.destination ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.bar} aria-label="Nuovo link breve">
      <form onSubmit={submit} className={styles.form}>
        <Link2 size={18} aria-hidden="true" className={styles.icon} />
        <label className="visually-hidden" htmlFor="quick-link-url">
          URL da accorciare
        </label>
        <input
          id="quick-link-url"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="Incolla un link da accorciare"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "quick-link-error" : undefined}
        />
        <Button type="submit" loading={busy} icon={<Plus size={16} />}>
          Crea link
        </Button>
      </form>
      {error && (
        <p id="quick-link-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {last && advanced?.(last)}
    </section>
  );
}
