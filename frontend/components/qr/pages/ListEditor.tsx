"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button, IconButton } from "@/components/ui";
import styles from "./pages.module.css";

type Props<T> = {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  create: () => T;
  addLabel: string;
  max?: number;
  itemLabel: (index: number) => string;
};

/** Add, remove and reorder rows of a repeatable field (links, tracks, phones…). */
export function ListEditor<T>({
  items,
  onChange,
  render,
  create,
  addLabel,
  max = 30,
  itemLabel,
}: Props<T>) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  return (
    <div className={styles.list}>
      {items.map((item, index) => (
        <div key={index} className={styles.row}>
          <div className={styles.rowFields}>
            {render(
              item,
              (patch) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it))),
              index,
            )}
          </div>
          <div className={styles.rowActions}>
            <IconButton
              label={`Sposta su ${itemLabel(index)}`}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp size={16} />
            </IconButton>
            <IconButton
              label={`Sposta giù ${itemLabel(index)}`}
              disabled={index === items.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown size={16} />
            </IconButton>
            <IconButton
              label={`Rimuovi ${itemLabel(index)}`}
              tone="danger"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={16} />
            </IconButton>
          </div>
        </div>
      ))}
      {items.length < max && (
        <Button
          variant="secondary"
          icon={<Plus size={16} />}
          onClick={() => onChange([...items, create()])}
        >
          {addLabel}
        </Button>
      )}
    </div>
  );
}
