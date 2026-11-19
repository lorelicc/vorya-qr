"use client";
import { Download, FolderInput, Pause, Play, Tag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { csrfHeaders } from "@/lib/auth-client";
import { useReducedMotion } from "@/lib/motion";
import type { QrCode } from "@/lib/types";
import { DeleteDialog } from "@/components/qr/DeleteDialog";
import { FolderPicker } from "./FolderPicker";
import type { Organize } from "./useOrganize";
import styles from "./organize.module.css";

/** Rises from the bottom while something is selected (transform + opacity only). */
export function SelectionBar({
  selected,
  items,
  org,
  onClear,
  onDone,
}: {
  selected: Set<number>;
  items: QrCode[];
  org: Organize;
  onClear: () => void;
  onDone: () => void;
}) {
  const { api: base } = useCompany();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [moving, setMoving] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [zip, setZip] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [format, setFormat] = useState<"png" | "svg" | "pdf">("png");
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const ids = [...selected];
  const count = ids.length;
  const withQr = items.filter((q) => selected.has(q.id) && q.has_qr).length;

  async function bulk(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await api(`${base}/qr-codes/bulk`, "POST", { ids, ...body });
      toast.show(done);
      onDone();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    try {
      const response = await fetch(`/api/${base}/qr-codes/bulk-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ ids, format, size: 1024 }),
      });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Download non riuscito.");
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement("a"), {
        href: url,
        download: "vorya-qr.zip",
      });
      link.click();
      URL.revokeObjectURL(url);
      setZip(false);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!count) return null;
  return (
    <div
      className={styles.bar}
      role="region"
      aria-label="Azioni sulla selezione"
      data-reduced={reduced || undefined}
    >
      <strong aria-live="polite">{count} selezionati</strong>
      <div className={styles.barActions}>
        <Button variant="ghost" icon={<FolderInput size={16} />} onClick={() => setMoving(true)}>
          Sposta
        </Button>
        <Button variant="ghost" icon={<Tag size={16} />} onClick={() => setTagging(true)}>
          Tag
        </Button>
        <Button
          variant="ghost"
          icon={<Pause size={16} />}
          loading={busy}
          onClick={() => bulk({ action: "pause" }, "Messi in pausa.")}
        >
          Pausa
        </Button>
        <Button
          variant="ghost"
          icon={<Play size={16} />}
          loading={busy}
          onClick={() => bulk({ action: "resume" }, "Riattivati.")}
        >
          Riattiva
        </Button>
        <Button
          variant="ghost"
          icon={<Download size={16} />}
          disabled={!withQr}
          onClick={() => setZip(true)}
        >
          Scarica ZIP
        </Button>
        <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setDeleting(true)}>
          Elimina
        </Button>
        <Button variant="secondary" icon={<X size={16} />} onClick={onClear}>
          Annulla
        </Button>
      </div>
      {deleting && (
        <DeleteDialog
          items={items.filter((q) => selected.has(q.id))}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false);
            onDone();
          }}
        />
      )}

      <FolderPicker
        open={moving}
        title={`Sposta ${count} elementi in…`}
        folders={org.folders}
        onClose={() => setMoving(false)}
        onPick={async (folder_id) => {
          await bulk({ action: "move", folder_id }, "Spostati.");
          setMoving(false);
        }}
      />

      <Modal
        open={tagging}
        title="Tag"
        onClose={() => setTagging(false)}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!chosen.length}
              loading={busy}
              onClick={async () => {
                await bulk({ action: "untag", tag_ids: chosen }, "Tag rimossi.");
                setTagging(false);
              }}
            >
              Rimuovi
            </Button>
            <Button
              disabled={!chosen.length}
              loading={busy}
              onClick={async () => {
                await bulk({ action: "tag", tag_ids: chosen }, "Tag aggiunti.");
                setTagging(false);
              }}
            >
              Aggiungi
            </Button>
          </>
        }
      >
        {org.tags.length === 0 ? (
          <p className="muted">Crea prima un tag dalla barra dei filtri.</p>
        ) : (
          <div className={styles.picker}>
            {org.tags.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={chosen.includes(t.id)}
                  onChange={(e) =>
                    setChosen((all) =>
                      e.target.checked ? [...all, t.id] : all.filter((i) => i !== t.id),
                    )
                  }
                />{" "}
                {t.name}
              </label>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={zip}
        title="Scarica in ZIP"
        onClose={() => setZip(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setZip(false)}>
              Annulla
            </Button>
            <Button loading={busy} onClick={download}>
              Scarica
            </Button>
          </>
        }
      >
        <p>
          {withQr} QR nel file (i link senza QR sono esclusi). Un file per elemento, con il nome del
          QR.
        </p>
        <div role="radiogroup" aria-label="Formato" className={styles.picker}>
          {(["png", "svg", "pdf"] as const).map((f) => (
            <label key={f}>
              <input type="radio" name="fmt" checked={format === f} onChange={() => setFormat(f)} />{" "}
              {f.toUpperCase()}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
