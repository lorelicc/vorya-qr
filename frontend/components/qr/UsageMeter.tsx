import { limitLabel } from "@/lib/format";
import type { UsageItem } from "@/lib/types";
import styles from "./UsageMeter.module.css";

/** Plan usage for one QR kind. Over-limit (after a downgrade) is explicit, nothing is disabled. */
export function UsageMeter({ label, usage }: { label: string; usage: UsageItem }) {
  const { used, limit, over_limit: over } = usage;
  const percent = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, (used / limit) * 100);
  const tone = over ? styles.over : !usage.can_create ? styles.full : "";
  return (
    <div className={`${styles.meter} ${tone}`}>
      <div className={styles.top}>
        <span>{label}</span>
        <strong>
          {used} / {limitLabel(limit)}
        </strong>
      </div>
      {limit !== null && (
        <div
          className={styles.track}
          role="progressbar"
          aria-label={`${label}: ${used} su ${limit}`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      {over && (
        <p className={styles.note}>
          Oltre il limite del piano: i QR esistenti restano attivi, ma non puoi crearne di nuovi
          finché non ne elimini {used - (limit ?? 0)}.
        </p>
      )}
      {!over && !usage.can_create && <p className={styles.note}>Limite raggiunto.</p>}
    </div>
  );
}
