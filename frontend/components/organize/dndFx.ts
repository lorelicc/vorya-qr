"use client";
import { createContext, useContext } from "react";

/** Visual state shared by the dashboard pieces while links are dragged into folders. */
export type DndFx = {
  /** A drag is in progress (folder rows show they are targets). */
  dragging: boolean;
  /** Ids that just got dropped on a folder: their cards shrink away. */
  leaving: Set<number>;
  /** Droppable id of the folder that just received something (it "pops"). */
  received: string | null;
};

export const DndFxContext = createContext<DndFx>({
  dragging: false,
  leaving: new Set(),
  received: null,
});
export const useDndFx = () => useContext(DndFxContext);
