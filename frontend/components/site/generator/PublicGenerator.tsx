"use client";
import { CheckCircle2, CircleAlert, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { StaticNotice } from "@/components/qr/StaticNotice";
import { STATIC_DEFAULTS, StaticForm } from "@/components/qr/types/StaticForm";
import type { QrTypeKey } from "@/components/qr/types/meta";
import { Button, Disclosure } from "@/components/ui";
import { GeneratorDesign } from "./GeneratorDesign";
import { DEFAULT_DESIGN } from "@/lib/design";
import { useDebouncedValue } from "@/lib/hooks";
import { noteGenerator, saveHandoff } from "@/lib/site/attribution";
import { PublicApiError, publicDownload, publicPost, trackEvent } from "@/lib/site/public-api";
import type { QrDesign, Scannability } from "@/lib/types";
import styles from "./generator.module.css";

export type GeneratorType = Extract<
  QrTypeKey,
  "website" | "text" | "wifi" | "email" | "sms" | "phone" | "whatsapp" | "vcard_static"
>;
export const GENERATOR_TYPES: { key: GeneratorType; label: string }[] = [
  { key: "website", label: "Sito web" },
  { key: "vcard_static", label: "vCard" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "text", label: "Testo" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "phone", label: "Telefono" },
  { key: "whatsapp", label: "WhatsApp" },
];
type Preview = { svg: string; content: string; scannability: Scannability };
type Data = Record<string, string | boolean>;
const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const DYNAMIC_TYPES = new Set<GeneratorType>(["website", "vcard_static"]);

/**
 * Free generator (no account). Static codes only: the content lives in the QR, so it works
 * forever. Rendering, scan check and downloads are done by the server, with nothing stored.
 */
export function PublicGenerator({
  initialType = "website",
  landing = "/genera",
  compact = false,
}: {
  initialType?: GeneratorType;
  landing?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<GeneratorType>(initialType);
  const [data, setData] = useState<Data>({ ...(STATIC_DEFAULTS[initialType] as Data) });
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  const [logo, setLogo] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"png" | "svg" | null>(null);
  const [trap, setTrap] = useState("");
  const [touched, setTouched] = useState(false);
  const viewed = useRef(false);

  const body = useMemo(
    () => ({ type, data, design: { ...design, logo: logo ? (design.logo ?? { file_id: "x", size: 0.22, padding: 0.02, plate: true }) : null }, logo, landing, hp: trap }),
    [type, data, design, logo, landing, trap],
  ); // prettier-ignore
  // Before the visitor types anything the preview shows an example QR (nothing to download yet).
  const sample = { ...body, type: "website", data: { url: "https://qr.vorya.it" } };
  const key = useDebouncedValue(JSON.stringify(touched ? body : sample), 350);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    publicPost("public/generator/track", { event: "view", type: initialType, landing }).catch(
      () => undefined,
    );
  }, [initialType, landing]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the checking state for this request
    setLoading(true);
    publicPost<Preview>("public/generator/preview", JSON.parse(key), controller.signal)
      .then((result) => {
        setPreview(result);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof PublicApiError ? err.message : "Anteprima non disponibile.");
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [key]);

  function chooseType(next: GeneratorType) {
    setType(next);
    setTouched(false);
    setData({ ...(STATIC_DEFAULTS[next] as Data) });
    setPreview(null);
  }

  async function download(format: "png" | "svg") {
    setBusy(format);
    setError("");
    try {
      const blob = await publicDownload("public/generator/download", {
        ...body,
        format,
        size: 1024,
      });
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement("a"), {
        href: url,
        download: `qr-${type}.${format}`,
      }).click();
      URL.revokeObjectURL(url);
      trackEvent("generatore-download");
      noteGenerator(type);
    } catch (err) {
      setError(err instanceof PublicApiError ? err.message : "Download non riuscito.");
    } finally {
      setBusy(null);
    }
  }

  function goDynamic() {
    saveHandoff({
      type: type as "website" | "vcard_static",
      data,
      design: { ...design, logo: null },
    });
    noteGenerator(type);
    trackEvent("generatore-crea-dinamico");
    router.push("/register?da=generatore");
  }

  const canDynamic = DYNAMIC_TYPES.has(type);
  const scan = preview?.scannability;
  return (
    <div className={styles.generator} data-compact={compact || undefined}>
      <div className={styles.types} role="tablist" aria-label="Tipo di QR">
        {GENERATOR_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={type === t.key}
            onClick={() => chooseType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.split}>
        <div className={styles.form}>
          <StaticForm
            type={type}
            value={data}
            onChange={(next) => {
              setTouched(true);
              setData(next);
            }}
          />
          <input
            className={styles.trap}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            name="website_url"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />
          <Disclosure title="Personalizza lo stile" summary="Forme, colori, logo">
            <GeneratorDesign design={design} onChange={setDesign} logo={logo} onLogo={setLogo} />
          </Disclosure>
        </div>
        <div className={styles.result}>
          <figure className={styles.preview} aria-busy={loading}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl(preview.svg)}
                alt="Anteprima del codice QR"
                width={240}
                height={240}
              />
            ) : (
              <span className={styles.placeholder}>Anteprima…</span>
            )}
          </figure>
          {loading ? (
            <p className={styles.badge} data-state="checking">
              <Loader2 size={16} className={styles.spin} aria-hidden="true" /> Verifica della
              lettura…
            </p>
          ) : !touched ? (
            <p className={styles.badge} data-state="checking" role="status">
              Anteprima di esempio: compila i campi
            </p>
          ) : scan?.scannable ? (
            <p className={styles.badge} data-state="ok" role="status">
              <CheckCircle2 size={16} aria-hidden="true" /> Scansionabile
            </p>
          ) : null}
          {error && (
            <p className={styles.badge} data-state="error" role="alert">
              <CircleAlert size={16} aria-hidden="true" /> {error}
            </p>
          )}
          {scan && !scan.scannable && !error && (
            <p className={styles.badge} data-state="error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              {scan.reasons
                .filter((r) => r.blocking)
                .map((r) => r.message)
                .join(" ")}
            </p>
          )}
          <div className={styles.downloads}>
            <Button
              icon={<Download size={16} />}
              loading={busy === "png"}
              disabled={!touched || !scan?.scannable}
              onClick={() => download("png")}
              data-umami-event="generatore-download-png"
            >
              Scarica PNG
            </Button>
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              loading={busy === "svg"}
              disabled={!touched || !scan?.scannable}
              onClick={() => download("svg")}
            >
              Scarica SVG
            </Button>
          </div>
          <p className={styles.hint}>
            Gratis, senza registrazione e senza filigrana. È un QR statico: il contenuto è scritto
            nel codice, quindi funziona per sempre.
          </p>
        </div>
      </div>
      <StaticNotice
        show
        cta={
          canDynamic
            ? {
                text: "Vuoi poterlo modificare dopo la stampa e vedere quante persone lo scansionano? Crealo dinamico, gratis.",
                label: "Crealo dinamico, gratis",
                onClick: goDynamic,
                event: "generatore-cta-dinamico",
              }
            : {
                text: "Vuoi salvare i tuoi QR e gestirli da un'unica dashboard? Crea un account gratis.",
                label: "Crea un account gratis",
                onClick: () => router.push("/register?da=generatore"),
                event: "generatore-cta-account",
              }
        }
      />
    </div>
  );
}
