"use client";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"; // prettier-ignore
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable"; // prettier-ignore
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button, Select, useToast } from "@/components/ui";
import { blockId, findBlock, upsertBlock } from "@/components/qr/pages/defaults";
import type { FormProps } from "@/components/qr/pages/shared";
import { TextArea } from "@/components/qr/types/StaticForm";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { Lang, MenuBlock, MenuItem, MenuSection } from "@/lib/page-types";
import { ItemSheet } from "./ItemSheet";
import { SectionCard } from "./SectionCard";
import styles from "./menu-editor.module.css";

const newBlock = (): MenuBlock => ({
  id: blockId("m"), type: "menu", currency: "EUR", intro: { it: "", en: "" }, sections: [],
}); // prettier-ignore
const newItem = (): MenuItem => ({
  id: blockId("i"), name: { it: "", en: "" }, description: { it: "", en: "" }, price: null,
  photo_file_id: null, allergens: [], badges: [], sold_out: false, wine: null,
}); // prettier-ignore

/**
 * Menu / wine list editor, designed for a phone: big toggles for "esaurito", inline prices,
 * a bottom sheet for the rest. When the QR already exists, sold-out and price changes are saved
 * right away (no need to press "Salva").
 */
export function MenuEditor({
  page,
  onChange,
  files,
  addFile,
  qrId,
}: FormProps & { qrId?: number }) {
  const { api: base } = useCompany();
  const toast = useToast();
  const block = findBlock(page, "menu") ?? newBlock();
  const languages: Lang[] = page.settings.languages ?? ["it"];
  const [editing, setEditing] = useState<{
    sectionId: string;
    item: MenuItem;
    isNew: boolean;
  } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const setBlock = (patch: Partial<MenuBlock>) =>
    onChange(upsertBlock(page, "menu", patch, newBlock));
  const setSections = (sections: MenuSection[]) => setBlock({ sections });
  const mapSection = (id: string, fn: (s: MenuSection) => MenuSection) =>
    setSections(block.sections.map((s) => (s.id === id ? fn(s) : s)));
  const mapItem = (sid: string, iid: string, patch: Partial<MenuItem>) =>
    mapSection(sid, (s) => ({
      ...s,
      items: s.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)),
    }));

  async function quick(
    sid: string,
    item: MenuItem,
    patch: { sold_out?: boolean; price?: string | null },
  ) {
    mapItem(sid, item.id, patch);
    if (!qrId) return; // not saved yet: the normal Save button persists everything
    try {
      await api(`${base}/qr-codes/${qrId}/menu/items/${item.id}`, "PATCH", patch);
      if ("sold_out" in patch)
        toast.show(patch.sold_out ? "Segnata come esaurita." : "Di nuovo disponibile.");
    } catch (err) {
      mapItem(sid, item.id, { sold_out: item.sold_out, price: item.price });
      toast.show(errorMessage(err), "error");
    }
  }

  function move<T>(list: T[], index: number, delta: number): T[] {
    const to = index + delta;
    return to < 0 || to >= list.length ? list : arrayMove(list, index, to);
  }
  function dragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = block.sections.findIndex((s) => s.id === active.id);
    const to = block.sections.findIndex((s) => s.id === over.id);
    setSections(arrayMove(block.sections, from, to));
  }

  return (
    <div className="stack">
      <div className={styles.grid}>
        <Select
          label="Valuta"
          value={block.currency}
          onChange={(e) => setBlock({ currency: e.target.value as MenuBlock["currency"] })}
        >
          {["EUR", "GBP", "USD", "CHF"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <label className={styles.switchRow}>
          <input
            type="checkbox"
            checked={languages.includes("en")}
            onChange={(e) =>
              onChange({
                ...page,
                settings: { ...page.settings, languages: e.target.checked ? ["it", "en"] : ["it"] },
              })
            }
          />
          Aggiungi la versione in inglese
        </label>
      </div>
      <TextArea
        label="Presentazione (italiano)"
        value={block.intro.it}
        max={300}
        onChange={(e) => setBlock({ intro: { ...block.intro, it: e.target.value } })}
      />
      {languages.includes("en") && (
        <TextArea
          label="Introduction (English)"
          value={block.intro.en}
          max={300}
          onChange={(e) => setBlock({ intro: { ...block.intro, en: e.target.value } })}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
        <SortableContext
          items={block.sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {block.sections.map((section, si) => (
            <SectionCard
              key={section.id}
              section={section}
              languages={languages}
              onSection={(fn) => mapSection(section.id, fn)}
              onMoveSection={(delta) => setSections(move(block.sections, si, delta))}
              onDeleteSection={() => setSections(block.sections.filter((x) => x.id !== section.id))}
              onQuick={(item, patch) => quick(section.id, item, patch)}
              onEdit={(item, isNew) => setEditing({ sectionId: section.id, item, isNew })}
              newItem={newItem}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className={styles.addRow}>
        <Button
          variant="secondary"
          icon={<Plus size={16} />}
          onClick={() =>
            setSections([
              ...block.sections,
              { id: blockId("s"), kind: "food", title: { it: "", en: "" }, items: [] },
            ])
          }
        >
          Aggiungi una sezione
        </Button>
        <Button
          variant="secondary"
          icon={<Plus size={16} />}
          onClick={() =>
            setSections([
              ...block.sections,
              { id: blockId("s"), kind: "wine", title: { it: "Vini", en: "Wines" }, items: [] },
            ])
          }
        >
          Aggiungi una sezione vini
        </Button>
      </div>

      {editing && (
        <ItemSheet
          item={editing.item}
          section={block.sections.find((s) => s.id === editing.sectionId)!}
          languages={languages}
          files={files}
          addFile={addFile}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            mapSection(editing.sectionId, (s) => ({
              ...s,
              items: editing.isNew
                ? [...s.items, saved]
                : s.items.map((i) => (i.id === saved.id ? saved : i)),
            }));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
