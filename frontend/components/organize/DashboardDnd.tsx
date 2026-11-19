"use client";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type ReactNode } from "react";
import type { QrCode } from "@/lib/types";
import styles from "./organize.module.css";

const announcements = {
  onDragStart: () =>
    "Elemento sollevato. Usa le frecce per scegliere una cartella, Spazio per rilasciare.",
  onDragOver: ({ over }: { over: { id: string | number } | null }) =>
    over ? "Sopra una cartella." : "Fuori dalle cartelle.",
  onDragEnd: ({ over }: { over: { id: string | number } | null }) =>
    over ? "Elemento spostato." : "Spostamento annullato.",
  onDragCancel: () => "Spostamento annullato.",
};

/**
 * Drag and drop of links (and folders) onto folders. Touch starts after a short press so the
 * page still scrolls; keyboard users pick up the handle with Space. The "Sposta in…" menus are
 * the equivalent for everyone who cannot or does not want to drag.
 */
export function DashboardDnd({
  items,
  selected,
  folderName,
  onDropLinks,
  onDropFolder,
  children,
}: {
  items: QrCode[];
  selected: Set<number>;
  folderName: (id: number) => string;
  onDropLinks: (ids: number[], folderId: number | null) => void;
  onDropFolder: (folderId: number, parent: number | null) => void;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function end(event: DragEndEvent) {
    setDragging(null);
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over) return;
    const target =
      over === "folder-none" || over === "folder-all"
        ? null
        : over.startsWith("folder-")
          ? Number(over.slice(7))
          : undefined;
    if (target === undefined) return;
    if (active.startsWith("qr-")) {
      const id = Number(active.slice(3));
      onDropLinks(selected.has(id) ? [...selected] : [id], over === "folder-all" ? null : target);
    } else if (active.startsWith("dragfolder-")) {
      const id = Number(active.slice(11));
      if (id !== target) onDropFolder(id, target);
    }
  }

  const label = (() => {
    if (!dragging) return "";
    if (dragging.startsWith("dragfolder-")) return `📁 ${folderName(Number(dragging.slice(11)))}`;
    const id = Number(dragging.slice(3));
    const count = selected.has(id) ? selected.size : 1;
    return count > 1 ? `${count} elementi` : (items.find((q) => q.id === id)?.name ?? "Elemento");
  })();

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Per spostare in una cartella premi Spazio, usa le frecce per scegliere la cartella e Spazio per rilasciare. Esc annulla.",
        },
      }}
      onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
      onDragEnd={end}
      onDragCancel={() => setDragging(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging ? <div className={styles.ghost}>{label}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
