"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import type { QrCode, QrKind, QrStyle } from "@/lib/types";
import { KindPicker } from "./KindPicker";
import { QrPreview } from "./QrPreview";
import { DEFAULT_STYLE, StylePanel } from "./StylePanel";
import styles from "./QrEditor.module.css";

type Props = { initial?: QrCode; onSaved?: (qr: QrCode) => void };

function styleOf(qr?: QrCode): QrStyle {
  if (!qr) return DEFAULT_STYLE;
  const { fg_color, bg_color, margin, error_correction } = qr;
  return { fg_color, bg_color, margin, error_correction };
}

/** Create or edit a QR code: data on the left, live preview on the right. */
export function QrEditor({ initial, onSaved }: Props) {
  const router = useRouter();
  const { api: base, app } = useCompany();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<QrKind>(initial?.kind ?? "dynamic");
  const [targetUrl, setTargetUrl] = useState(initial?.target_url ?? "https://");
  const [style, setStyle] = useState<QrStyle>(styleOf(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial);
  const staticUrlChanged = initial?.kind === "static" && targetUrl !== initial.target_url;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    const body = { name, target_url: targetUrl, ...style };
    try {
      const saved = editing
        ? await api<QrCode>(`${base}/qr-codes/${initial!.id}`, "PUT", body)
        : await api<QrCode>(`${base}/qr-codes`, "POST", { ...body, kind, content_type: "url" });
      toast.show(editing ? "Modifiche salvate." : "Codice QR creato.");
      if (editing) onSaved?.(saved);
      else router.push(`${app}/qr/${saved.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.editor} onSubmit={submit} noValidate>
      <div className={styles.fields}>
        <Card title="Contenuto">
          <div className="stack">
            <Input
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              error={errors.name}
              hint="Visibile solo a te, per ritrovare il QR."
            />
            {!editing && <KindPicker value={kind} onChange={setKind} />}
            <Input
              label={kind === "dynamic" ? "URL di destinazione" : "URL"}
              type="url"
              inputMode="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
              error={errors.target_url}
              hint={
                kind === "dynamic"
                  ? "Puoi cambiarla in qualsiasi momento senza ristampare il QR."
                  : staticUrlChanged
                    ? "Attenzione: cambiando l’URL cambia anche l’immagine. I QR già stampati continueranno a puntare al vecchio indirizzo."
                    : "L’URL viene scritto direttamente nel QR e non potrà cambiare dopo la stampa."
              }
            />
          </div>
        </Card>
        <Card title="Aspetto">
          <StylePanel value={style} onChange={setStyle} />
        </Card>
      </div>
      <aside className={styles.side}>
        <Card title="Anteprima">
          <QrPreview kind={kind} targetUrl={targetUrl} style={style} qrId={initial?.id} />
          <Button type="submit" loading={busy} block className={styles.save}>
            {editing ? "Salva modifiche" : "Crea codice QR"}
          </Button>
        </Card>
      </aside>
    </form>
  );
}
