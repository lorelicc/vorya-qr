"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { Lang, MenuItem, MenuSection } from "@/lib/page-types";
import styles from "./menu-editor.module.css";

/** One menu section: sortable by drag, by buttons, and with its items listed for quick edits. */
export function SectionCard({
  section,
  languages,
  onSection,
  onMoveSection,
  onDeleteSection,
  onQuick,
  onEdit,
  newItem,
}: {
  section: MenuSection;
  languages: Lang[];
  onSection: (fn: (s: MenuSection) => MenuSection) => void;
  onMoveSection: (delta: -1 | 1) => void;
  onDeleteSection: () => void;
  onQuick: (item: MenuItem, patch: { sold_out?: boolean; price?: string | null }) => void;
  onEdit: (item: MenuItem, isNew: boolean) => void;
  newItem: () => MenuItem;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const english = languages.includes("en");
  const moveItem = (index: number, delta: number) =>
    onSection((s) => {
      const to = index + delta;
      if (to < 0 || to >= s.items.length) return s;
      const items = [...s.items];
      [items[index], items[to]] = [items[to], items[index]];
      return { ...s, items };
    });
  const title = section.title.it;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={styles.section}
      data-dragging={isDragging || undefined}
    >
      <div className={styles.sectionHead}>
        <button
          type="button"
          className={styles.handle}
          aria-label="Trascina per riordinare la sezione"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <Input
          label="Sezione"
          value={title}
          placeholder="Antipasti"
          maxLength={300}
          onChange={(e) => onSection((s) => ({ ...s, title: { ...s.title, it: e.target.value } }))}
        />
        {english && (
          <Input
            label="Section (EN)"
            value={section.title.en}
            placeholder="Starters"
            maxLength={300}
            onChange={(e) =>
              onSection((s) => ({ ...s, title: { ...s.title, en: e.target.value } }))
            }
          />
        )}
        <Select
          label="Tipo"
          value={section.kind}
          onChange={(e) =>
            onSection((s) => ({ ...s, kind: e.target.value as MenuSection["kind"] }))
          }
        >
          <option value="food">Cucina</option>
          <option value="wine">Vini</option>
        </Select>
        <div className={styles.rowTools}>
          <button
            type="button"
            aria-label={`Sposta su la sezione ${title}`}
            onClick={() => onMoveSection(-1)}
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            aria-label={`Sposta giù la sezione ${title}`}
            onClick={() => onMoveSection(1)}
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            aria-label={`Elimina la sezione ${title}`}
            onClick={onDeleteSection}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <ul className={styles.items}>
        {section.items.map((item, index) => (
          <li key={item.id} className={styles.itemRow} data-sold-out={item.sold_out || undefined}>
            <button type="button" className={styles.itemName} onClick={() => onEdit(item, false)}>
              <strong>{item.name.it || "Senza nome"}</strong>
              <Pencil size={12} aria-hidden="true" />
            </button>
            {section.kind === "food" && (
              <label className={styles.priceInput}>
                <span className="visually-hidden">Prezzo di {item.name.it}</span>
                <input
                  inputMode="decimal"
                  placeholder="0,00"
                  defaultValue={item.price ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (item.price ?? "") &&
                    onQuick(item, { price: e.target.value || null })
                  }
                />
              </label>
            )}
            <label className={styles.soldOut}>
              <input
                type="checkbox"
                role="switch"
                checked={item.sold_out}
                onChange={(e) => onQuick(item, { sold_out: e.target.checked })}
              />
              Esaurito
            </label>
            <span className={styles.rowTools}>
              <button
                type="button"
                aria-label={`Sposta su ${item.name.it}`}
                onClick={() => moveItem(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label={`Sposta giù ${item.name.it}`}
                onClick={() => moveItem(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                aria-label={`Elimina ${item.name.it}`}
                onClick={() =>
                  onSection((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }))
                }
              >
                <Trash2 size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Button variant="ghost" icon={<Plus size={16} />} onClick={() => onEdit(newItem(), true)}>
        Aggiungi una voce
      </Button>
    </div>
  );
}
