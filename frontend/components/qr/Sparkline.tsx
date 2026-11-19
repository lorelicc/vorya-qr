import styles from "./QrList.module.css";

/** Tiny 7-day scan trend. Decorative: the number next to it carries the information. */
export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 64;
  const h = 20;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values.map(
    (v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`,
  );
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={points.join(" ")} pathLength={1} />
    </svg>
  );
}
