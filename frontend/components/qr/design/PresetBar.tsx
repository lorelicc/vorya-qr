"use client";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Input, Select, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrDesign, StylePresetItem } from "@/lib/types";
import styles from "./design.module.css";

/** Apply a saved company style, or save the current design as a new one. */
export function PresetBar({
  design,
  onApply,
}: {
  design: QrDesign;
  onApply: (design: QrDesign) => void;
}) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [presets, setPresets] = useState<StylePresetItem[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<StylePresetItem[]>(`${base}/styles`)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [base]);

  async function save() {
    setBusy(true);
    try {
      const preset = await api<StylePresetItem>(`${base}/styles`, "POST", {
        name: name.trim(),
        design,
      });
      setPresets((all) => [...all, preset]);
      setName("");
      toast.show(`Stile «${preset.name}» salvato.`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.presets}>
      {presets.length > 0 && (
        <Select
          label="Stili salvati"
          value=""
          onChange={(e) => {
            const preset = presets.find((p) => String(p.id) === e.target.value);
            if (preset) onApply(preset.design);
          }}
        >
          <option value="">Applica uno stile…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      <Input
        label="Nuovo stile"
        placeholder="Es. Stile aziendale"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        variant="secondary"
        icon={<Save size={16} />}
        loading={busy}
        disabled={!name.trim()}
        onClick={save}
      >
        Salva stile
      </Button>
    </div>
  );
}
