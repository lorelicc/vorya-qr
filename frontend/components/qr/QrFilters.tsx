"use client";
import { Search } from "lucide-react";
import { fieldStyles } from "@/components/ui";
import styles from "./QrFilters.module.css";

export type Filters = {
  search: string;
  kind: "" | "static" | "dynamic";
  status: "" | "active" | "paused" | "blocked";
};

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
        <span className="visually-hidden">Tipo</span>
        <select
          className={`${fieldStyles.control} ${fieldStyles.select}`}
          value={value.kind}
          onChange={(event) => onChange({ ...value, kind: event.target.value as Filters["kind"] })}
        >
          <option value="">Tutti i tipi</option>
          <option value="dynamic">Dinamici</option>
          <option value="static">Statici</option>
        </select>
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
