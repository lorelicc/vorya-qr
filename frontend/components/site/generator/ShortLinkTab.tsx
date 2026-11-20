"use client";
import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { noteGenerator } from "@/lib/site/attribution";
import { trackEvent } from "@/lib/site/public-api";
import styles from "./generator.module.css";

const HOST = "qr.vorya.it";
const valid = (value: string) => {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
};

/**
 * Link shortener preview. No anonymous links (abuse): it shows what the short link will look like
 * and the creation asks for a free account.
 */
export function ShortLinkTab() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const ok = valid(url.trim());
  return (
    <div className={styles.generator}>
      <Input
        label="Incolla il link da accorciare"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.esempio.it/una-pagina-molto-lunga"
      />
      <div className={styles.shortPreview} aria-live="polite">
        <Link2 size={18} aria-hidden="true" />
        <span>
          {HOST}/<strong>{ok ? "a1B2c3D" : "…"}</strong>
        </span>
        <small>
          {ok
            ? "Anteprima: il vero indirizzo viene creato con l'account."
            : "Inserisci un link valido."}
        </small>
      </div>
      <Button
        disabled={!ok}
        data-umami-event="linkbreve-crea"
        onClick={() => {
          noteGenerator("link");
          trackEvent("linkbreve-crea");
          router.push("/register?da=link-breve");
        }}
      >
        Crea il link: registrati gratis
      </Button>
      <p className={styles.hint}>Senza carta di credito. Niente link anonimi, per evitare abusi.</p>
    </div>
  );
}
