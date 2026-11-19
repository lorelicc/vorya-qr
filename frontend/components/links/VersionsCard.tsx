"use client";
import { History, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PhonePreview } from "@/components/qr/PhonePreview";
import { TYPE_BY_KEY, type QrTypeKey } from "@/components/qr/types/meta";
import { Badge, Button, Card, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { formatDateTime } from "@/lib/format";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import type { AccountPlan, QrCode } from "@/lib/types";
import styles from "./links.module.css";

type Version = {
  number: number;
  qr_type: string;
  destination: "redirect" | "page";
  target_url: string;
  change: "created" | "content" | "type" | "destination" | "restore";
  author: string | null;
  created_at: string;
};
type Detail = Version & { page: PageDoc | null; files: PageFiles };

const CHANGE: Record<Version["change"], string> = {
  created: "Creato",
  content: "Contenuto",
  type: "Cambio di tipo",
  destination: "Nuova destinazione",
  restore: "Ripristino",
};
const typeLabel = (t: string) => TYPE_BY_KEY[t as QrTypeKey]?.label ?? t;

/** Content history: preview any of the last 20 versions and restore it. */
export function VersionsCard({
  qr,
  plan,
  onRestored,
}: {
  qr: QrCode;
  plan: AccountPlan | null;
  onRestored: (qr: QrCode) => void;
}) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [preview, setPreview] = useState<Detail | null>(null);
  const [restoring, setRestoring] = useState<Version | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = plan?.features.version_history ?? true;

  const load = useCallback(() => {
    api<Version[]>(`${base}/qr-codes/${qr.id}/versions`)
      .then(setVersions)
      .catch(() => setVersions([]));
  }, [base, qr.id]);
  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  async function open(v: Version) {
    try {
      setPreview(await api<Detail>(`${base}/qr-codes/${qr.id}/versions/${v.number}`));
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function restore() {
    if (!restoring) return;
    setBusy(true);
    try {
      const restored = await api<QrCode>(
        `${base}/qr-codes/${qr.id}/versions/${restoring.number}/restore`,
        "POST",
      );
      toast.show(`Versione ${restoring.number} ripristinata.`);
      setRestoring(null);
      setPreview(null);
      onRestored(restored);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed)
    return (
      <Card title="Cronologia delle versioni">
        <p className={styles.locked}>
          <Lock size={14} aria-hidden="true" /> Cronologia delle versioni: disponibile nel piano
          Pro.
        </p>
      </Card>
    );

  return (
    <Card
      title="Cronologia delle versioni"
      description="Ogni salvataggio crea una versione. Si conservano le ultime 20; i file delle versioni in cronologia contano nello spazio."
    >
      {versions === null ? (
        <p className="muted">Caricamento…</p>
      ) : (
        <ol className={styles.versions}>
          {versions.map((v, i) => (
            <li key={v.number}>
              <span className={styles.versionNumber}>
                <History size={14} aria-hidden="true" /> v{v.number}
              </span>
              <span>
                <strong>{typeLabel(v.qr_type)}</strong>{" "}
                <Badge tone={v.change === "type" ? "warning" : "neutral"}>{CHANGE[v.change]}</Badge>
                <small>
                  {formatDateTime(v.created_at)}
                  {v.author ? ` · ${v.author}` : ""}
                  {i === 0 ? " · attuale" : ""}
                </small>
              </span>
              <span className={styles.versionActions}>
                <Button variant="ghost" onClick={() => open(v)}>
                  Anteprima
                </Button>
                {i > 0 && (
                  <Button variant="secondary" onClick={() => setRestoring(v)}>
                    Ripristina questa versione
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={preview !== null}
        title={preview ? `Versione ${preview.number} · ${typeLabel(preview.qr_type)}` : ""}
        onClose={() => setPreview(null)}
        actions={<Button onClick={() => setPreview(null)}>Chiudi</Button>}
      >
        {preview?.page ? (
          <PhonePreview page={preview.page} files={preview.files} />
        ) : (
          <p>
            Porta a <code>{preview?.target_url}</code>
          </p>
        )}
      </Modal>

      <Modal
        open={restoring !== null}
        title="Ripristinare questa versione?"
        onClose={() => setRestoring(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRestoring(null)}>
              Annulla
            </Button>
            <Button loading={busy} onClick={restore}>
              Ripristina
            </Button>
          </>
        }
      >
        <p>
          Chi scansiona questo QR vedrà <strong>subito</strong> il contenuto della versione{" "}
          {restoring?.number} ({restoring ? typeLabel(restoring.qr_type) : ""}). Slug, back-half,
          design e statistiche non cambiano.
        </p>
      </Modal>
    </Card>
  );
}
