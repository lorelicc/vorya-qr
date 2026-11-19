import type { QrKind } from "@/lib/types";
import styles from "./KindPicker.module.css";

const OPTIONS: { value: QrKind; title: string; text: string }[] = [
  {
    value: "dynamic",
    title: "Dinamico",
    text: "Link breve modificabile, pausa e statistiche delle scansioni.",
  },
  {
    value: "static",
    title: "Statico",
    text: "L’URL è scritto nel QR: non si può modificare né misurare.",
  },
];

export function KindPicker({
  value,
  onChange,
}: {
  value: QrKind;
  onChange: (kind: QrKind) => void;
}) {
  return (
    <fieldset className={styles.picker}>
      <legend>Tipo di QR</legend>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`${styles.option} ${value === option.value ? styles.selected : ""}`}
          >
            <input
              type="radio"
              name="kind"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <strong>{option.title}</strong>
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
