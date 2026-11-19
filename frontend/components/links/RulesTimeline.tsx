import { formatDateTime } from "@/lib/format";
import styles from "./links.module.css";

type Entry = { at: Date; url: string };

/** Where the link points over time. Entries rise in one by one (transform + opacity only). */
export function RulesTimeline({
  base,
  entries,
  expires,
  now,
}: {
  base: string;
  entries: Entry[];
  expires: Date | null;
  now: number; // passed by the parent (render must stay pure)
}) {
  const sorted = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());
  const current = [...sorted].reverse().find((e) => e.at.getTime() <= now);
  if (!sorted.length && !expires) return null;
  return (
    <ol className={styles.timeline} aria-label="Cronologia delle destinazioni">
      <li data-state={current ? "past" : "now"} style={{ animationDelay: "0ms" }}>
        <strong>Ora</strong>
        <span title={base}>{base || "Destinazione del link"}</span>
      </li>
      {sorted.map((e, i) => (
        <li
          key={`${e.at.toISOString()}-${i}`}
          data-state={e === current ? "now" : e.at.getTime() <= now ? "past" : "future"}
          style={{ animationDelay: `${(i + 1) * 70}ms` }}
        >
          <strong>{formatDateTime(e.at.toISOString())}</strong>
          <span title={e.url}>{e.url}</span>
        </li>
      ))}
      {expires && (
        <li data-state="end" style={{ animationDelay: `${(sorted.length + 1) * 70}ms` }}>
          <strong>{formatDateTime(expires.toISOString())}</strong>
          <span>Il link scade</span>
        </li>
      )}
    </ol>
  );
}
