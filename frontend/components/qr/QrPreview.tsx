"use client";
import { useEffect, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage } from "@/lib/api";
import { useDebouncedValue } from "@/lib/hooks";
import type { QrKind, QrStyle } from "@/lib/types";
import styles from "./QrPreview.module.css";

type Props = { kind: QrKind; targetUrl: string; style: QrStyle; qrId?: number };
type Preview = { svg: string; content: string };

/** Live preview rendered by the backend (same engine as the downloads), shown as an <img>. */
export function QrPreview({ kind, targetUrl, style, qrId }: Props) {
  const { api: base } = useCompany();
  // Debounce a string key: a fresh object on every render would never settle.
  const key = useDebouncedValue(
    JSON.stringify({ kind, target_url: targetUrl, qr_id: qrId ?? null, ...style }),
    350,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    api<Preview>(`${base}/qr-codes/preview`, "POST", JSON.parse(key))
      .then((result) => {
        if (!current) return;
        setPreview(result);
        setError("");
      })
      .catch((err) => current && setError(errorMessage(err)));
    return () => {
      current = false;
    };
  }, [base, key]);

  return (
    <figure className={styles.preview}>
      <div className={styles.frame} aria-busy={!preview}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`}
            alt="Anteprima del codice QR"
          />
        ) : (
          <span className={styles.placeholder}>Anteprima…</span>
        )}
      </div>
      <figcaption>
        {error ? (
          <span className={styles.error}>{error}</span>
        ) : kind === "dynamic" ? (
          <>
            Il QR contiene il link breve{qrId ? "" : " (generato al salvataggio)"}:{" "}
            {preview?.content}
          </>
        ) : (
          <>Il QR contiene direttamente: {preview?.content}</>
        )}
      </figcaption>
    </figure>
  );
}
