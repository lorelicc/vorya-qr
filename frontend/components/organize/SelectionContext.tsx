"use client";
import { createContext, useContext } from "react";
import type { QrCode, TagItem } from "@/lib/types";

export type SelectionApi = {
  selected: Set<number>;
  toggle: (id: number) => void;
  tags: TagItem[];
  onMove: (qr: QrCode) => void;
};

export const SelectionContext = createContext<SelectionApi | null>(null);
export const useSelection = () => useContext(SelectionContext);
