"use client";
import { Search } from "lucide-react";
import { fieldStyles } from "@/components/ui";
import styles from "./QrFilters.module.css";

export type Filters = {
  search: string;
  view: "" | "links" | "dynamic_qr" | "static";
  status: "" | "active" | "paused" | "blocked";
};

export const VIEWS: { value: Filters["view"]; label: string }[] = [
  { value: "", label: "Tutti" },
  { value: "links", label: "Link brevi" },
  { value: "dynamic_qr", label: "QR dinamici" },
  { value: "static", label: "QR statici" },
];

/** Tutti / Link brevi / QR dinamici / QR statici. */
export function ViewTabs({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className={styles.views} role="radiogroup" aria-label="Mostra">
      {VIEWS.map((v) => (
        <button
          key={v.value || "all"}
          type="button"
          role="radio"
          aria-checked={value.view === v.value}
          onClick={() => onChange({ ...value, view: v.value })}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function QrFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  return (
    <div className={styles.filters} role="search">
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <span className="visually-hidden">Cerca per nome o destinazione</span>
        <input
          className={fieldStyles.control}
          type="search"
          placeholder="Cerca per nome o URL"
          value={value.search}
          onChange={(event) => onChange({ ...value, search: event.target.value })}
        />
      </label>
      <label>
        <span className="visually-hidden">Stato</span>
        <select
          className={`${fieldStyles.control} ${fieldStyles.select}`}
          value={value.status}
          onChange={(event) =>
            onChange({ ...value, status: event.target.value as Filters["status"] })
          }
        >
          <option value="">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="paused">In pausa</option>
          <option value="blocked">Bloccati</option>
        </select>
      </label>
    </div>
  );
}
