import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { QrCode } from "@/lib/types";
import { StatusBadge } from "./QrBadges";
import { QrQuickActions } from "./QrQuickActions";
import { typeLabel } from "./QrTable";
import { QrThumb } from "./QrThumb";
import { Sparkline } from "./Sparkline";
import type { QrActions } from "./useQrActions";
import styles from "./QrList.module.css";

export function QrCards({
  rows,
  base,
  actions,
}: {
  rows: QrCode[];
  base: string;
  actions: QrActions;
}) {
  return (
    <ul className={styles.cards}>
      {rows.map((qr, index) => (
        <li
          key={qr.id}
          className={styles.card}
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          <Link href={`${base}/qr/${qr.id}`} className={styles.cardLink}>
            <QrThumb qr={qr} src={actions.image(qr, "svg")} size={88} />
            <span className={styles.cardName}>{qr.name}</span>
          </Link>
          <span className={styles.cardType}>{typeLabel(qr)}</span>
          <div className={styles.cardMeta}>
            <StatusBadge qr={qr} />
            {qr.kind === "dynamic" && (
              <span className={styles.scans} title="Scansioni totali; linea: ultimi 7 giorni">
                {qr.spark && <Sparkline values={qr.spark} />}
                {formatNumber(qr.scan_count)}
              </span>
            )}
          </div>
          <QrQuickActions qr={qr} actions={actions} />
        </li>
      ))}
    </ul>
  );
}
