"use client";
import { useEffect, useId, useState } from "react";
import { Field, fieldStyles } from "@/components/ui";
import { isHexColor } from "@/lib/contrast";
import styles from "./ColorField.module.css";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the text box in sync with the picker
  useEffect(() => setText(value), [value]);
  const invalid = !isHexColor(text);

  return (
    <Field id={id} label={label} error={invalid ? "Usa il formato #RRGGBB" : undefined}>
      <div className={styles.row}>
        <input
          type="color"
          className={styles.swatch}
          value={value}
          aria-label={`${label}: selettore colore`}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          id={id}
          className={`${fieldStyles.control} ${styles.hex}`}
          value={text}
          maxLength={7}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            const next = event.target.value.trim();
            setText(next);
            if (isHexColor(next)) onChange(next.toLowerCase());
          }}
        />
      </div>
    </Field>
  );
}
