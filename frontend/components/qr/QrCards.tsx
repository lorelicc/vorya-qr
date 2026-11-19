import Link from "next/link";
import { DragHandle } from "@/components/organize/DragHandle";
import { useSelection } from "@/components/organize/SelectionContext";
import { TagDots } from "@/components/organize/TagsBar";
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
  const selection = useSelection();
  return (
    <ul className={styles.cards}>
      {rows.map((qr, index) => (
        <li
          key={qr.id}
          className={styles.card}
          data-selected={selection?.selected.has(qr.id) || undefined}
          style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        >
          {selection && (
            <div className={styles.cardTools}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={selection.selected.has(qr.id)}
                  onChange={() => selection.toggle(qr.id)}
                />
                <span className="visually-hidden">Seleziona {qr.name}</span>
              </label>
              <DragHandle id={qr.id} label={qr.name} />
            </div>
          )}
          <Link href={`${base}/qr/${qr.id}`} className={styles.cardLink}>
            <QrThumb qr={qr} src={actions.image(qr, "svg")} size={88} />
            <span className={styles.cardName}>{qr.name}</span>
          </Link>
          <span className={styles.cardType}>{typeLabel(qr)}</span>
          {selection && <TagDots tags={selection.tags} ids={qr.tag_ids} />}
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
