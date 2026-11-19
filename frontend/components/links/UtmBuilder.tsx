"use client";
import { Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Input, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { EMPTY_UTM, UTM_KEYS, utmConflicts, withUtm, type Utm } from "@/lib/utm";
import styles from "./links.module.css";

type Template = Utm & { id: number; name: string };
const LABEL: Record<(typeof UTM_KEYS)[number], string> = {
  source: "Source (es. newsletter)",
  medium: "Medium (es. email)",
  campaign: "Campaign",
  term: "Term",
  content: "Content",
};

/** Builds the final URL with live preview. `onApply` receives the URL with the UTM parameters. */
export function UtmBuilder({
  url,
  onApply,
  canTemplate = true,
}: {
  url: string;
  onApply: (url: string) => void;
  canTemplate?: boolean;
}) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [utm, setUtm] = useState<Utm>(EMPTY_UTM);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!canTemplate) return;
    api<Template[]>(`${base}/utm-templates`)
      .then(setTemplates)
      .catch(() => undefined);
  }, [base, canTemplate]);

  const conflicts = utmConflicts(url, utm);
  const final = withUtm(url, utm);
  const filled = UTM_KEYS.some((k) => utm[k].trim());

  async function save() {
    try {
      const created = await api<Template>(`${base}/utm-templates`, "POST", { name, ...utm });
      setTemplates((all) => [...all, created]);
      setName("");
      toast.show("Modello salvato.");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  async function remove(t: Template) {
    try {
      await api(`${base}/utm-templates/${t.id}`, "DELETE");
      setTemplates((all) => all.filter((x) => x.id !== t.id));
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="stack">
      {templates.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Modelli UTM">
          {templates.map((t) => (
            <span key={t.id} className={styles.chip}>
              <button type="button" onClick={() => setUtm({ ...EMPTY_UTM, ...t })}>
                {t.name}
              </button>
              <button
                type="button"
                aria-label={`Elimina il modello ${t.name}`}
                onClick={() => remove(t)}
              >
                <Trash2 size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={styles.grid2}>
        {UTM_KEYS.map((k) => (
          <Input
            key={k}
            label={LABEL[k]}
            value={utm[k]}
            onChange={(e) => setUtm({ ...utm, [k]: e.target.value })}
            maxLength={100}
            error={conflicts.includes(k) ? `utm_${k} è già nell'URL` : undefined}
          />
        ))}
      </div>
      <div className={styles.preview} aria-live="polite">
        <span className="muted">URL finale</span>
        <code>{final ?? "Inserisci prima un URL valido"}</code>
      </div>
      <div className={styles.row}>
        <Button
          variant="secondary"
          disabled={!final || !filled || conflicts.length > 0}
          onClick={() => final && onApply(final)}
        >
          Usa questo URL
        </Button>
        {canTemplate && (
          <>
            <Input
              label="Nome del modello"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            <Button
              variant="ghost"
              icon={<Save size={16} />}
              disabled={!name.trim() || !filled}
              onClick={save}
            >
              Salva modello
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
