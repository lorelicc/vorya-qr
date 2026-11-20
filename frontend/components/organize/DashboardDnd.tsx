"use client";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DropAnimation,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, type ReactNode } from "react";
import type { QrCode } from "@/lib/types";
import { DndFxContext } from "./dndFx";
import styles from "./organize.module.css";

/**
 * The folder under the POINTER is the target (the dragged card is much bigger than a folder row:
 * choosing by overlapping area drops it in a neighbour). Keyboard drags have no pointer: they use
 * the rectangles.
 */
const collision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

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
  thumb,
  currentFolder,
  children,
}: {
  items: QrCode[];
  selected: Set<number>;
  folderName: (id: number) => string;
  onDropLinks: (ids: number[], folderId: number | null) => void;
  onDropFolder: (folderId: number, parent: number | null) => void;
  /** Miniature of a link for the card that follows the pointer. */
  thumb: (qr: QrCode) => ReactNode;
  /** The folder being viewed ("" = all, "none" = unfiled, else an id): drops elsewhere remove the card. */
  currentFolder: string;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const [received, setReceived] = useState<string | null>(null);
  // How the overlay lands: flies into the folder it was dropped on, or glides back.
  const [dropAnimation, setDropAnimation] = useState<DropAnimation | null | undefined>(undefined);
  const calm = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function start(event: DragStartEvent) {
    calm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setDragging(String(event.active.id));
  }

  function flyTo(event: DragEndEvent): DropAnimation | null | undefined {
    if (calm.current) return null;
    const from = event.active.rect.current.translated;
    const to = event.over?.rect;
    if (!from || !to) return undefined;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    return {
      duration: 340,
      easing: "cubic-bezier(0.3, 0.7, 0.2, 1)",
      keyframes: ({ transform }) => [
        { transform: CSS.Transform.toString(transform.initial), opacity: 1 },
        {
          transform: `${CSS.Transform.toString({ ...transform.initial, x: transform.initial.x + dx, y: transform.initial.y + dy })} scale(0.2)`,
          opacity: 0,
        },
      ],
    };
  }

  function end(event: DragEndEvent) {
    setDragging(null);
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over) {
      setDropAnimation(calm.current ? null : undefined); // glide back to where it was
      return;
    }
    const target =
      over === "folder-none" || over === "folder-all"
        ? null
        : over.startsWith("folder-")
          ? Number(over.slice(7))
          : undefined;
    if (target === undefined) return;
    setDropAnimation(flyTo(event));
    setReceived(over);
    window.setTimeout(() => setReceived(null), 900);
    if (active.startsWith("qr-")) {
      const id = Number(active.slice(3));
      const ids = selected.has(id) ? [...selected] : [id];
      const folder = over === "folder-all" ? null : target;
      // Viewing a folder and dropping on another: the cards shrink away, then the move runs.
      const leaves = currentFolder !== "" && String(folder ?? "none") !== currentFolder;
      if (leaves && !calm.current) {
        setLeaving(new Set(ids));
        window.setTimeout(() => {
          onDropLinks(ids, folder);
          setLeaving(new Set());
        }, 260);
      } else onDropLinks(ids, folder);
    } else if (active.startsWith("dragfolder-")) {
      const id = Number(active.slice(11));
      if (id !== target) onDropFolder(id, target);
    }
  }

  const preview = (() => {
    if (!dragging) return null;
    if (dragging.startsWith("dragfolder-"))
      return <div className={styles.ghost}>📁 {folderName(Number(dragging.slice(11)))}</div>;
    const id = Number(dragging.slice(3));
    const qr = items.find((q) => q.id === id);
    const count = selected.has(id) ? selected.size : 1;
    if (!qr) return <div className={styles.ghost}>Elemento</div>;
    return (
      <div className={styles.dragCard} data-many={count > 1 || undefined}>
        {count > 1 && (
          <>
            <i className={styles.stackBack} />
            <i className={styles.stackMid} />
          </>
        )}
        <div className={styles.dragFace}>
          <span className={styles.dragThumb}>{thumb(qr)}</span>
          <b>{qr.name}</b>
          {count > 1 && <small>e altri {count - 1}</small>}
        </div>
        {count > 1 && <span className={styles.dragCount}>{count}</span>}
        <span className={styles.dragHint}>Rilascia su una cartella</span>
      </div>
    );
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Per spostare in una cartella premi Spazio, usa le frecce per scegliere la cartella e Spazio per rilasciare. Esc annulla.",
        },
      }}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragging(null)}
    >
      <DndFxContext.Provider value={{ dragging: dragging !== null, leaving, received }}>
        {children}
      </DndFxContext.Provider>
      <DragOverlay dropAnimation={dropAnimation} zIndex={80}>
        {preview}
      </DragOverlay>
    </DndContext>
  );
}
