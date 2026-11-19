"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { PageDoc, PageFiles } from "@/lib/page-types";
import type { AccountPlan, QrCode } from "@/lib/types";
import { TemplateForm } from "./pages/TemplateForms";
import { ThemeFields } from "./pages/shared";
import { PhonePreview } from "./PhonePreview";
import { QrPreview } from "./QrPreview";
import { StylePanel } from "./StylePanel";
import { StaticForm } from "./types/StaticForm";
import { TYPE_BY_KEY, isPageType } from "./types/meta";
import { TypePicker } from "./types/TypePicker";
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
  const editing = Boolean(initial);
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
            actions={editing ? <Badge tone="info">{TYPE_BY_KEY[type].label}</Badge> : undefined}
          >
            <div className="stack">
              <Input
                label="Nome del QR"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                required
                maxLength={120}
                error={errors.name}
                hint="Visibile solo a te, per ritrovare il QR."
              />
              {type === "website" && !editing && (
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={draft.dynamic}
                    onChange={(e) => update({ dynamic: e.target.checked })}
                  />{" "}
                  QR dinamico (destinazione modificabile e statistiche)
                </label>
              )}
              {type === "website" && q.kind === "dynamic" && (
                <Input
                  label="URL di destinazione"
                  type="url"
                  inputMode="url"
                  value={draft.target_url}
                  onChange={(e) => update({ target_url: e.target.value })}
                  error={errors.target_url}
                  hint="Puoi cambiarla in qualsiasi momento senza ristampare il QR."
                />
              )}
              {q.kind === "static" && (
                <StaticForm
                  type={type}
                  value={draft.static_data}
                  onChange={(static_data) => update({ static_data })}
                  errors={errors.static_data}
                />
              )}
              {page && (
                <TemplateForm
                  page={page}
                  onChange={(p) => update({ page: p })}
                  files={q.files}
                  addFile={q.addFile}
                />
              )}
              {errors.page && (
                <p className={styles.error} role="alert">
                  {errors.page}
                </p>
              )}
            </div>
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
        {type && (
          <Card title="Aspetto del QR">
            <StylePanel value={draft.style} onChange={(style) => update({ style })} />
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
            ) : (
              <QrPreview
                payload={q.previewPayload}
                dynamic={q.kind === "dynamic"}
                qrId={initial?.id}
              />
            )}
            <Button type="submit" loading={busy} block className={styles.save}>
              {editing ? "Salva modifiche" : "Crea codice QR"}
            </Button>
          </Card>
        </aside>
      )}
    </form>
  );
}
