"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Repeat } from "lucide-react";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { ChangeTypeModal } from "./ChangeTypeModal";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import type { AccountPlan, QrCode, Scannability } from "@/lib/types";
import { ThemeFields } from "./pages/shared";
import { PhonePreview } from "./PhonePreview";
import { QrPreview } from "./QrPreview";
import { DesignPanel } from "./design/DesignPanel";
import { TYPE_BY_KEY, isPageType, type QrTypeKey } from "./types/meta";
import { TypePicker } from "./types/TypePicker";
import { ContentFields } from "./ContentFields";
import { useQrDraft } from "./useQrDraft";
import styles from "./QrEditor.module.css";

type Props = {
  initial?: QrCode;
  initialPage?: PageDoc | null;
  initialFiles?: PageFiles;
  onSaved?: (qr: QrCode) => void;
};

/** Create or edit any QR type: content (guided form) on the left, live previews on the right. */
export function QrEditor({ initial, initialPage, initialFiles, onSaved }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { api: base, app, company } = useCompany();
  const q = useQrDraft(company, initial, initialPage, initialFiles);
  const { draft, update } = q;
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"qr" | "page">("qr");
  const [scan, setScan] = useState<Scannability | null>(null);
  const onScannability = useCallback((result: Scannability | null) => setScan(result), []);
  const editing = Boolean(initial);
  const [changing, setChanging] = useState(false);
  const type = draft.qr_type;
  const page = type && isPageType(type) ? draft.page : null;

  useEffect(() => {
    api<AccountPlan>("account/plan")
      .then(setPlan)
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const saved = editing
        ? await api<QrCode>(`${base}/qr-codes/${initial!.id}`, "PUT", q.payload())
        : await api<QrCode>(`${base}/qr-codes`, "POST", q.createPayload());
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
        {!editing && (
          <Card title="Tipo di QR">
            <TypePicker
              value={type}
              allowed={plan?.features.allowed_types ?? []}
              onChange={q.chooseType}
            />
          </Card>
        )}
        {type && (
          <Card
            title="Contenuto"
            actions={
              editing ? (
                <span
                  style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}
                >
                  <Badge tone={q.typeChanged ? "warning" : "info"}>{TYPE_BY_KEY[type].label}</Badge>
                  {initial?.kind === "dynamic" && (
                    <Button
                      variant="ghost"
                      icon={<Repeat size={14} />}
                      onClick={() => setChanging(true)}
                    >
                      Cambia tipo
                    </Button>
                  )}
                </span>
              ) : undefined
            }
          >
            <ContentFields q={q} editing={editing} errors={errors} />
          </Card>
        )}
        {page && (
          <Card title="Pagina">
            <ThemeFields
              page={page}
              onChange={(p) => update({ page: p })}
              files={q.files}
              addFile={q.addFile}
              canRemoveBranding={Boolean(plan?.features.remove_branding)}
            />
          </Card>
        )}
        {type && initial?.has_qr !== false && (
          <Card title="Aspetto del QR">
            <DesignPanel
              value={draft.design}
              onChange={(design) => update({ design })}
              files={q.files}
              addFile={q.addFile}
            />
          </Card>
        )}
      </div>
      {type && (
        <aside className={styles.side}>
          <Card title="Anteprima">
            {page && (
              <div className={styles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "qr"}
                  onClick={() => setView("qr")}
                >
                  QR
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "page"}
                  onClick={() => setView("page")}
                >
                  Pagina
                </button>
              </div>
            )}
            {page && view === "page" ? (
              <PhonePreview page={page} files={q.files} />
            ) : initial?.has_qr === false ? (
              <p className="muted">
                Link breve senza QR. Usa «Genera QR» per ottenere anche il codice da stampare.
              </p>
            ) : (
              <QrPreview
                payload={q.previewPayload}
                dynamic={q.kind === "dynamic"}
                qrId={initial?.id}
                onScannability={onScannability}
              />
            )}
            <Button
              type="submit"
              loading={busy}
              block
              className={styles.save}
              disabled={scan !== null && !scan.scannable}
            >
              {editing
                ? q.typeChanged
                  ? "Salva e cambia tipo"
                  : "Salva modifiche"
                : "Crea codice QR"}
            </Button>
          </Card>
        </aside>
      )}
      {initial && (
        <ChangeTypeModal
          open={changing}
          current={initial.qr_type as QrTypeKey}
          allowed={plan?.features.allowed_types ?? []}
          history={plan?.features.version_history ?? false}
          onClose={() => setChanging(false)}
          onConfirm={(next, prefill) => {
            q.chooseType(next);
            q.update({ dynamic: true, ...prefill });
            setChanging(false);
          }}
          qrId={initial.id}
        />
      )}
    </form>
  );
}
