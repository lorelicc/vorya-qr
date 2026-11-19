"use client";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import styles from "./organize.module.css";

/** Drag handle of a link card/row. Keyboard users pick it up with Space and use the arrows. */
export function DragHandle({ id, label }: { id: number; label: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `qr-${id}` });
  return (
    <button
      type="button"
      ref={setNodeRef}
      className={styles.handle}
      aria-label={`Trascina «${label}» in una cartella`}
      title="Trascina in una cartella"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={16} aria-hidden="true" />
    </button>
  );
}
