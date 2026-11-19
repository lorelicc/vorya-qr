"use client";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { PageDoc } from "@/lib/page-types";
import { TYPE_BY_KEY, type QrTypeKey } from "./types/meta";
import { TypePicker } from "./types/TypePicker";
import type { Draft } from "./useQrDraft";

type VersionDetail = { qr_type: string; target_url: string; page: PageDoc | null };

/**
 * Pick the new type of a dynamic link. If the type was used before, the form is prefilled with
 * its last version (when the plan keeps history). Slug, design and statistics never change.
 */
export function ChangeTypeModal({
  open,
  current,
  allowed,
  history,
  qrId,
  onClose,
  onConfirm,
}: {
  open: boolean;
  current: QrTypeKey;
  allowed: string[];
  history: boolean;
  qrId: number;
  onClose: () => void;
  onConfirm: (type: QrTypeKey, prefill: Partial<Draft>) => void;
}) {
  const { api: base } = useCompany();
  const [picked, setPicked] = useState<QrTypeKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!picked) return;
    setBusy(true);
    let prefill: Partial<Draft> = {};
    if (history) {
      try {
        const [last] = await api<VersionDetail[]>(
          `${base}/qr-codes/${qrId}/versions?qr_type=${picked}`,
        );
        if (last) prefill = { target_url: last.target_url || "https://", page: last.page };
      } catch {
        /* no history: the form starts from the defaults of that type */
      }
    }
    setBusy(false);
    onConfirm(picked, prefill);
    setPicked(null);
  }

  return (
    <Modal
      open={open}
      title="Cambia tipo"
      size="md"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annulla
          </Button>
          <Button loading={busy} disabled={!picked || picked === current} onClick={confirm}>
            Continua
          </Button>
        </>
      }
    >
      <div className="stack">
        <p role="note" style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
          <TriangleAlert size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            <strong>Chi scansiona questo QR vedrà subito il nuovo contenuto</strong>, appena salvi.
            Link breve, back-half, design, regole e statistiche restano gli stessi.
          </span>
        </p>
        <TypePicker value={picked ?? current} allowed={allowed} onChange={setPicked} dynamicOnly />
        {picked && picked !== current && (
          <p className="muted">
            Nuovo tipo: <strong>{TYPE_BY_KEY[picked].label}</strong>. Compila il contenuto e premi
            «Salva e cambia tipo».
          </p>
        )}
      </div>
    </Modal>
  );
}
