"use client";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import styles from "./organize.module.css";

/** Grip of a link card/row. The whole card is the drag source (pointer); the grip is the handle
 *  keyboard users pick up with Space (arrows to choose a folder). Same draggable instance. */
export function DragGrip({
  activatorRef,
  attributes,
  listeners,
  label,
}: {
  activatorRef: (element: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  label: string;
}) {
  return (
    <button
      type="button"
      ref={activatorRef}
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

/** Only the pointer/touch activators: the card itself must not steal keyboard focus from its links. */
export function pickPointer(listeners: DraggableSyntheticListeners): Record<string, unknown> {
  const l = (listeners ?? {}) as Record<string, unknown>;
  return {
    onPointerDown: l.onPointerDown,
    onTouchStart: l.onTouchStart,
    onMouseDown: l.onMouseDown,
  };
}

/** The grip of the row being rendered (table cells are rendered apart from their row). */
export const GripContext = createContext<ReactNode>(null);
export const useGrip = () => useContext(GripContext);
