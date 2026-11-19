import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./Disclosure.module.css";

/**
 * A titled section that can be folded (native <details>: keyboard and screen-reader friendly).
 * `summary` is a short hint shown while closed ("3 selezionati"), so folding never hides state.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={styles.box} open={defaultOpen || undefined}>
      <summary className={styles.head}>
        <span className={styles.title}>{title}</span>
        {summary && <span className={styles.summary}>{summary}</span>}
        <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
