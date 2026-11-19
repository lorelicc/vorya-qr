"use client";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Select } from "@/components/ui";
import type { Filters } from "@/components/qr/QrFilters";
import styles from "./organize.module.css";

export const SORTS: {
  value: string;
  label: string;
  sort: Filters["sort"];
  order: Filters["order"];
}[] = [
  { value: "created-desc", label: "Più recenti", sort: "created", order: "desc" },
  { value: "created-asc", label: "Meno recenti", sort: "created", order: "asc" },
  { value: "name-asc", label: "Nome (A–Z)", sort: "name", order: "asc" },
  { value: "name-desc", label: "Nome (Z–A)", sort: "name", order: "desc" },
  { value: "scans-desc", label: "Più scansionati", sort: "scans", order: "desc" },
  { value: "updated-desc", label: "Modificati di recente", sort: "updated", order: "desc" },
];

/** Sorting, creation date and number of scans, behind one disclosure. */
export function MoreFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = Boolean(value.createdFrom || value.createdTo || value.scansMin);
  return (
    <div className={styles.more}>
      <button
        type="button"
        className={styles.moreToggle}
        aria-expanded={open}
        aria-controls="more-filters"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal size={14} aria-hidden="true" /> Filtri e ordine
        {active ? " (attivi)" : ""}
      </button>
      {open && (
        <div id="more-filters" className={styles.moreGrid}>
          <Select
            label="Ordina per"
            value={`${value.sort}-${value.order}`}
            onChange={(e) => {
              const next = SORTS.find((s) => s.value === e.target.value)!;
              onChange({ ...value, sort: next.sort, order: next.order });
            }}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <label className={styles.dateField}>
            <span>Creati dal</span>
            <input
              type="date"
              value={value.createdFrom}
              onChange={(e) => onChange({ ...value, createdFrom: e.target.value })}
            />
          </label>
          <label className={styles.dateField}>
            <span>al</span>
            <input
              type="date"
              value={value.createdTo}
              onChange={(e) => onChange({ ...value, createdTo: e.target.value })}
            />
          </label>
          <label className={styles.dateField}>
            <span>Almeno N scansioni</span>
            <input
              type="number"
              min={0}
              value={value.scansMin}
              onChange={(e) => onChange({ ...value, scansMin: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
