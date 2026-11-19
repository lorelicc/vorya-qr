"use client";
import { Input } from "@/components/ui";
import type { FieldErrors } from "@/lib/api";
import { TemplateForm } from "./pages/TemplateForms";
import { StaticForm } from "./types/StaticForm";
import type { useQrDraft } from "./useQrDraft";
import styles from "./QrEditor.module.css";

type Draft = ReturnType<typeof useQrDraft>;

/** Name + type-specific content (URL, static data or page blocks). Shared by editor and wizard. */
export function ContentFields({
  q,
  editing,
  errors,
  qrId,
}: {
  q: Draft;
  editing: boolean;
  errors: FieldErrors;
  qrId?: number;
}) {
  const { draft, update } = q;
  const type = draft.qr_type;
  if (!type) return null;
  const page = draft.page && draft.page.template === type ? draft.page : null;
  return (
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
          error={errors.target_url ?? errors.destination}
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
          qrId={qrId}
        />
      )}
      {(errors.page || (errors.destination && !(type === "website" && q.kind === "dynamic"))) && (
        <p className={styles.error} role="alert">
          {errors.page ?? errors.destination}
        </p>
      )}
    </div>
  );
}
