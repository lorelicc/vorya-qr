"use client";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { useDebouncedValue } from "@/lib/hooks";
import type { Scannability } from "@/lib/types";
import styles from "./QrPreview.module.css";

type Props = {
  payload: Record<string, unknown>;
  dynamic: boolean;
  qrId?: number;
  onScannability?: (result: Scannability | null) => void;
};
type Preview = { svg: string; content: string; scannability: Scannability };
const src = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Live preview rendered and decoded by the backend (same engine as the downloads). Two stacked
 * images crossfade when the style changes; the badge says whether the QR actually scans.
 */
export function QrPreview({ payload, dynamic, qrId, onScannability }: Props) {
  const { api: base } = useCompany();
  const key = useDebouncedValue(
    JSON.stringify({ ...payload, page: undefined, qr_id: qrId ?? null }),
    350,
  );
  const [layers, setLayers] = useState<{
    current: string | null;
    previous: string | null;
    tick: number;
  }>({ current: null, previous: null, tick: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the checking state for this request
    setLoading(true);
    api<Preview>(`${base}/qr-codes/preview`, "POST", JSON.parse(key))
      .then((result) => {
        if (!alive) return;
        setPreview(result);
        setLayers((l) => ({ current: src(result.svg), previous: l.current, tick: l.tick + 1 }));
        setError("");
        onScannability?.(result.scannability);
      })
      .catch((err) => {
        if (!alive) return;
        setError(errorMessage(err));
        onScannability?.(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [base, key, onScannability]);

  const scan = preview?.scannability;
  return (
    <figure className={styles.preview}>
      <div className={styles.frame} aria-busy={loading}>
        {layers.previous && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`p${layers.tick}`}
            src={layers.previous}
            alt=""
            className={styles.previous}
            aria-hidden="true"
          />
        )}
        {layers.current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`c${layers.tick}`}
            src={layers.current}
            alt="Anteprima del codice QR"
            className={styles.current}
          />
        ) : (
          <span className={styles.placeholder}>Anteprima…</span>
        )}
      </div>
      {loading ? (
        <p className={styles.badge} data-state="checking">
          <Loader2 size={16} className={styles.spin} aria-hidden="true" /> Verifica della lettura…
        </p>
      ) : scan?.scannable ? (
        <p className={styles.badge} data-state="ok" role="status">
          <CheckCircle2 size={16} aria-hidden="true" /> Scansionabile
        </p>
      ) : scan ? (
        <div className={styles.badge} data-state="error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          <span>
            {scan.reasons
              .filter((r) => r.blocking)
              .map((r) => r.message)
              .join(" ")}
          </span>
        </div>
      ) : null}
      {scan?.reasons
        .filter((r) => !r.blocking)
        .map((r) => (
          <p key={r.code} className={styles.note}>
            {r.message}
          </p>
        ))}
      <figcaption>
        {error ? (
          <span className={styles.error}>{error}</span>
        ) : dynamic ? (
          <>
            Il QR contiene il link breve{qrId ? "" : " (generato al salvataggio)"}:{" "}
            {preview?.content}
          </>
        ) : (
          <>Il QR contiene: {preview?.content}</>
        )}
      </figcaption>
    </figure>
  );
}
