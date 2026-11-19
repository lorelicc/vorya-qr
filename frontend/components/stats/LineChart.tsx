"use client";
import { useEffect, useId, useRef, useState } from "react";
import { formatDay, formatNumber } from "@/lib/format";
import type { StatsDay } from "@/lib/types";
import styles from "./LineChart.module.css";

type Series = { key: "count" | "unique" | "clicks"; label: string; tone: "main" | "soft" };

const H = 200;

function path(days: StatsDay[], key: Series["key"], max: number, W: number): string {
  const step = days.length > 1 ? W / (days.length - 1) : 0;
  return days
    .map(
      (d, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(H - (d[key] / max) * H).toFixed(1)}`,
    )
    .join("");
}

/**
 * Hand-made SVG line chart (no chart library), drawn at its real pixel width. Lines draw in on
 * mount (stroke-dashoffset on a normalised pathLength), skipped with reduced motion. Labels are HTML so they keep their size;
 * a hidden table gives screen readers the exact values.
 */
export function LineChart({ days, series }: { days: StatsDay[]; series: Series[] }) {
  const gradient = useId();
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const node = box.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    // Real pixel width: strokes and dashes stay undistorted (no preserveAspectRatio="none").
    const observer = new ResizeObserver(([entry]) =>
      setW(Math.max(120, Math.round(entry.contentRect.width))),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(1, ...days.flatMap((d) => series.map((s) => d[s.key])));
  const ticks = [max, Math.round(max / 2), 0].filter((v, i, all) => all.indexOf(v) === i);
  const labelled = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  const main = series[0];
  const area = days.length ? `${path(days, main.key, max, W)}L${W} ${H}L0 ${H}Z` : "";
  const key = days.map((d) => d.date).join() + max; // replays the draw-in when data changes

  return (
    <figure className={styles.chart}>
      <ul className={styles.legend}>
        {series.map((s) => (
          <li key={s.key} data-tone={s.tone}>
            {s.label}
          </li>
        ))}
      </ul>
      <div className={styles.plot}>
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick}>{formatNumber(tick)}</span>
          ))}
        </div>
        <div ref={box}>
          <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" key={key}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--vorya-green-middle)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--vorya-green-middle)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, H / 2, H].map((y) => (
              <line key={y} x1={0} x2={W} y1={y} y2={y} className={styles.grid} />
            ))}
            <path d={area} fill={`url(#${gradient})`} className={styles.area} />
            {series.map((s) => (
              <path
                key={s.key}
                d={path(days, s.key, max, W)}
                pathLength={1}
                className={styles.line}
                data-tone={s.tone}
              />
            ))}
          </svg>
        </div>
      </div>
      <div className={styles.labels} aria-hidden="true">
        {labelled.map((i) => (days[i] ? <span key={i}>{formatDay(days[i].date)}</span> : null))}
      </div>
      <div className="visually-hidden">
        <table>
          <caption>Andamento giornaliero</caption>
          <thead>
            <tr>
              <th scope="col">Giorno</th>
              {series.map((s) => (
                <th scope="col" key={s.key}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <th scope="row">{formatDay(d.date)}</th>
                {series.map((s) => (
                  <td key={s.key}>{d[s.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
