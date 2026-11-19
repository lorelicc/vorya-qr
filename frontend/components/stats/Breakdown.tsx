import { formatNumber } from "@/lib/format";
import type { Breakdown as BreakdownData } from "@/lib/types";
import styles from "./Breakdown.module.css";

export function Breakdown({ items }: { items: BreakdownData }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <p className="muted">Ancora nessuna scansione.</p>;
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const percent = Math.round((item.count / total) * 100);
        return (
          <li key={item.label}>
            <div className={styles.row}>
              <span>{item.label}</span>
              <span>
                {formatNumber(item.count)} <small>({percent}%)</small>
              </span>
            </div>
            <div className={styles.track} aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
