"use client";
import { ChevronDown, Link2, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink, useToast } from "@/components/ui";
import { UtmBuilder } from "./UtmBuilder";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";
import styles from "./QuickLinkBar.module.css";

/**
 * Paste a URL → short link in one tap, copied to the clipboard. `advanced` (back-half, UTM,
 * rules) opens below once the link exists.
 */
export function QuickLinkBar({ onCreated }: { onCreated: (link: QrCode) => void }) {
  const { api: base, app } = useCompany();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState<QrCode | null>(null);
  const [open, setOpen] = useState(false);

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
        // Never wait forever: some browsers leave the promise pending while asking permission.
        await Promise.race([
          navigator.clipboard.writeText(short),
          new Promise((_, reject) => window.setTimeout(reject, 800)),
        ]);
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
        <Button type="submit" variant="secondary" loading={busy} icon={<Plus size={16} />}>
          Crea link
        </Button>
      </form>
      {error && (
        <p id="quick-link-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {last && (
        <div className={styles.advanced}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls="quick-advanced"
            onClick={() => setOpen((v) => !v)}
          >
            Opzioni avanzate per questo link <ChevronDown size={14} aria-hidden="true" />
          </button>
          {open && (
            <div id="quick-advanced" className={styles.panel}>
              <p className="muted">
                Link creato: <code>{last.root_url}</code>. Il link e le sue regole si modificano
                anche dalla pagina del link.
              </p>
              <UtmBuilder
                url={last.target_url}
                canTemplate={false}
                onApply={async (finalUrl) => {
                  try {
                    const updated = await api<QrCode>(`${base}/qr-codes/${last.id}`, "PUT", {
                      name: last.name,
                      target_url: finalUrl,
                    });
                    setLast(updated);
                    onCreated(updated);
                    toast.show("URL con UTM salvato.");
                  } catch (err) {
                    toast.show(errorMessage(err), "error");
                  }
                }}
              />
              <ButtonLink href={`${app}/qr/${last.id}`} variant="secondary">
                Back-half e regole
              </ButtonLink>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
