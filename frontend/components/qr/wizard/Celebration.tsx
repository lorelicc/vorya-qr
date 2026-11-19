"use client";
import { useReducedMotion } from "@/lib/motion";
import styles from "./wizard.module.css";

const SHAPES = [
  { x: -78, y: -40, r: 7, tone: "mint", d: 0 },
  { x: 74, y: -52, r: 6, tone: "lilac", d: 40 },
  { x: -64, y: 46, r: 5, tone: "peach", d: 80 },
  { x: 82, y: 34, r: 8, tone: "glow", d: 20 },
  { x: 0, y: -84, r: 4, tone: "peach", d: 60 },
  { x: -96, y: 2, r: 4, tone: "lilac", d: 100 },
  { x: 98, y: -6, r: 5, tone: "mint", d: 120 },
];

/**
 * Plays once on creation (< 1.2 s): a check draws itself and a few --art-* shapes spread out.
 * With reduced motion the final state is shown immediately.
 */
export function Celebration() {
  const reduced = useReducedMotion();
  return (
    <div className={styles.celebration} data-reduced={reduced || undefined} aria-hidden="true">
      <svg viewBox="-110 -100 220 200" width={220} height={200}>
        {SHAPES.map((s, i) => (
          <circle
            key={i}
            className={styles.burst}
            r={s.r}
            fill={`var(--art-${s.tone})`}
            style={
              {
                "--bx": `${s.x}px`,
                "--by": `${s.y}px`,
                animationDelay: `${s.d}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        <circle className={styles.ring} r={46} fill="var(--art-mint)" />
        <circle r={36} fill="var(--art-mid)" />
        <path
          className={styles.check}
          d="M-15 1l10 10 21-22"
          pathLength={1}
          fill="none"
          stroke="var(--art-paper)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
