import { formatNumber } from "@/lib/format";
import type { Breakdown as BreakdownData } from "@/lib/types";
import styles from "./Breakdown.module.css";

export function Breakdown({
  items,
  empty = "Ancora nessuna scansione.",
}: {
  items: BreakdownData;
  empty?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <p className="muted">{empty}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item, index) => {
        const share = item.count / total;
        return (
          <li key={`${item.label}-${index}`}>
            <div className={styles.row}>
              <span>{item.label}</span>
              <span>
                {formatNumber(item.count)} <small>({Math.round(share * 100)}%)</small>
              </span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <span style={{ transform: `scaleX(${share})`, animationDelay: `${index * 40}ms` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
