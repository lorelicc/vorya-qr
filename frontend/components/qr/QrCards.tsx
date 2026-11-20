import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { DragGrip, pickPointer } from "@/components/organize/DragHandle";
import { useDndFx } from "@/components/organize/dndFx";
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

function QrCard({
  qr,
  index,
  base,
  actions,
}: {
  qr: QrCode;
  index: number;
  base: string;
  actions: QrActions;
}) {
  const selection = useSelection();
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `qr-${qr.id}`,
  });
  const { leaving } = useDndFx();
  return (
    <>
      <li
        ref={setNodeRef}
        className={styles.card}
        data-selected={selection?.selected.has(qr.id) || undefined}
        data-dragging={isDragging || undefined}
        data-leaving={leaving.has(qr.id) || undefined}
        data-draggable={selection ? "" : undefined}
        style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
        {...(selection ? pickPointer(listeners) : {})}
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
            <DragGrip
              activatorRef={setActivatorNodeRef}
              attributes={attributes}
              listeners={listeners}
              label={qr.name}
            />
          </div>
        )}
        <Link href={`${base}/qr/${qr.id}`} className={styles.cardLink} draggable={false}>
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
    </>
  );
}

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
        <QrCard key={qr.id} qr={qr} index={index} base={base} actions={actions} />
      ))}
    </ul>
  );
}
