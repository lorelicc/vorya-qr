import { Lock } from "lucide-react";
import { TYPES, type QrTypeKey } from "./meta";
import styles from "./TypePicker.module.css";

type Props = {
  value: QrTypeKey | null;
  allowed: string[];
  onChange: (key: QrTypeKey) => void;
  dynamicOnly?: boolean; // type change of a dynamic link: static types do not apply
};

const GROUPS = [
  {
    key: "page",
    title: "Pagine dinamiche",
    hint: "Contenuto ospitato, modificabile, con statistiche.",
  },
  { key: "redirect", title: "Link dinamico", hint: "Destinazione modificabile, con statistiche." },
  {
    key: "static",
    title: "Statici",
    hint: "Il contenuto è scritto nel QR e funziona anche offline.",
  },
] as const;

/** Type grid. Types outside the plan stay visible with a lock. */
export function TypePicker({ value, allowed, onChange, dynamicOnly }: Props) {
  return (
    <div className={styles.groups}>
      {GROUPS.filter((g) => !dynamicOnly || g.key !== "static").map((group) => (
        <fieldset key={group.key} className={styles.group}>
          <legend>
            {group.title} <small>{group.hint}</small>
          </legend>
          <div className={styles.grid}>
            {TYPES.filter((t) => t.group === group.key).map((type) => {
              const locked = !allowed.includes(type.key);
              const Icon = type.icon;
              return (
                <label
                  key={type.key}
                  className={styles.card}
                  data-selected={value === type.key || undefined}
                  data-locked={locked || undefined}
                >
                  <input
                    type="radio"
                    name="qr_type"
                    value={type.key}
                    checked={value === type.key}
                    disabled={locked}
                    onChange={() => onChange(type.key)}
                  />
                  <span className={styles.art} aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <strong>
                    {type.label} {locked && <Lock size={14} aria-label="Bloccato" />}
                  </strong>
                  <span className={styles.desc}>
                    {locked ? "Disponibile nel piano Pro." : type.description}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
