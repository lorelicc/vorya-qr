"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import type { StatsRange } from "@/lib/types";
import styles from "./RangePicker.module.css";

export type RangeValue = { range: StatsRange; start?: string; end?: string };

const OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "7d", label: "7 giorni" },
  { value: "30d", label: "30 giorni" },
  { value: "90d", label: "90 giorni" },
  { value: "custom", label: "Personalizzato" },
];

export function rangeQuery(value: RangeValue): string {
  const params = new URLSearchParams({ range: value.range });
  if (value.range === "custom" && value.start && value.end) {
    params.set("start", value.start);
    params.set("end", value.end);
  }
  return params.toString();
}

export function RangePicker({
  value,
  onChange,
}: {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
}) {
  const [custom, setCustom] = useState(value.range === "custom");
  const [start, setStart] = useState(value.start ?? "");
  const [end, setEnd] = useState(value.end ?? "");
  const active = custom ? "custom" : value.range;
  return (
    <div className={styles.wrap}>
      <div className={styles.segmented} role="radiogroup" aria-label="Periodo">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active === option.value}
            className={styles.option}
            onClick={() => {
              setCustom(option.value === "custom");
              if (option.value !== "custom") onChange({ range: option.value });
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {custom && (
        <form
          className={styles.custom}
          onSubmit={(event) => {
            event.preventDefault();
            if (start && end) onChange({ range: "custom", start, end });
          }}
        >
          <label>
            Dal
            <input
              type="date"
              value={start}
              max={end || undefined}
              required
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Al
            <input
              type="date"
              value={end}
              min={start || undefined}
              required
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <Button type="submit" variant="secondary">
            Applica
          </Button>
        </form>
      )}
    </div>
  );
}
