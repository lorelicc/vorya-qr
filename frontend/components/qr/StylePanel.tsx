"use client";
import { AlertTriangle } from "lucide-react";
import { useId } from "react";
import { Button, Select } from "@/components/ui";
import { qrWarnings } from "@/lib/contrast";
import type { QrStyle } from "@/lib/types";
import { ColorField } from "./ColorField";
import styles from "./StylePanel.module.css";

export const DEFAULT_STYLE: QrStyle = {
  fg_color: "#091411",
  bg_color: "#ffffff",
  margin: 4,
  error_correction: "M",
};

const EC_LABEL = {
  L: "Bassa (L, ~7%)",
  M: "Media (M, ~15%), consigliata",
  Q: "Alta (Q, ~25%)",
  H: "Massima (H, ~30%)",
} as const;

export function StylePanel({
  value,
  onChange,
}: {
  value: QrStyle;
  onChange: (next: QrStyle) => void;
}) {
  const marginId = useId();
  const warnings = qrWarnings(value.fg_color, value.bg_color, value.margin);
  const set = (patch: Partial<QrStyle>) => onChange({ ...value, ...patch });

  return (
    <div className={styles.panel}>
      <div className={styles.colors}>
        <ColorField
          label="Colore primo piano"
          value={value.fg_color}
          onChange={(fg_color) => set({ fg_color })}
        />
        <ColorField
          label="Colore sfondo"
          value={value.bg_color}
          onChange={(bg_color) => set({ bg_color })}
        />
      </div>
      <div className={styles.range}>
        <label htmlFor={marginId}>
          Margine <strong>{value.margin} moduli</strong>
        </label>
        <input
          id={marginId}
          type="range"
          min={0}
          max={16}
          value={value.margin}
          onChange={(event) => set({ margin: Number(event.target.value) })}
        />
      </div>
      <Select
        label="Correzione d’errore"
        value={value.error_correction}
        onChange={(event) =>
          set({ error_correction: event.target.value as QrStyle["error_correction"] })
        }
        hint="Più alta è la correzione, più il QR resiste a graffi e pieghe, ma diventa più fitto."
      >
        {Object.entries(EC_LABEL).map(([level, label]) => (
          <option key={level} value={level}>
            {label}
          </option>
        ))}
      </Select>
      {warnings.length > 0 && (
        <ul className={styles.warnings} aria-live="polite">
          {warnings.map((warning) => (
            <li key={warning.code}>
              <AlertTriangle size={16} aria-hidden="true" />
              {warning.message}
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" onClick={() => onChange(DEFAULT_STYLE)}>
        Ripristina stile predefinito
      </Button>
    </div>
  );
}
