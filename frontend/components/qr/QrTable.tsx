import Link from "next/link";
import { Table, type Column } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { QrCode } from "@/lib/types";
import { StatusBadge } from "./QrBadges";
import { DragHandle } from "@/components/organize/DragHandle";
import { useSelection } from "@/components/organize/SelectionContext";
import { TagDots } from "@/components/organize/TagsBar";
import { QrQuickActions } from "./QrQuickActions";
import { QrThumb } from "./QrThumb";
import { Sparkline } from "./Sparkline";
import { TYPE_BY_KEY } from "./types/meta";
import type { QrActions } from "./useQrActions";
import styles from "./QrList.module.css";

export const typeLabel = (qr: QrCode) =>
  !qr.has_qr
    ? `Link breve · ${(qr.root_url ?? "").replace(/^https?:\/\//, "")}`
    : `${TYPE_BY_KEY[qr.qr_type as keyof typeof TYPE_BY_KEY]?.label ?? qr.qr_type} · ${
        qr.kind === "dynamic" ? "dinamico" : "statico · non modificabile"
      }`;

const columnsFor = (base: string, actions: QrActions, withTools: boolean): Column<QrCode>[] => [
  ...(withTools ? [selectColumn()] : []),
  {
    key: "name",
    header: "Nome",
    mobileLabel: false,
    render: (qr) => (
      <div className={styles.nameCell}>
        <QrThumb qr={qr} src={actions.image(qr, "svg")} size={40} />
        <div className={styles.name}>
          <Link href={`${base}/qr/${qr.id}`}>{qr.name}</Link>
          <span>{typeLabel(qr)}</span>
          <TagsCell qr={qr} />
        </div>
      </div>
    ),
  },
  { key: "status", header: "Stato", render: (qr) => <StatusBadge qr={qr} /> },
  {
    key: "scans",
    header: "Scansioni (7 giorni)",
    align: "end",
    render: (qr) =>
      qr.kind === "dynamic" ? (
        <span className={styles.scans}>
          {qr.spark && <Sparkline values={qr.spark} />}
          {formatNumber(qr.scan_count)}
        </span>
      ) : (
        <span className="muted">n/d</span>
      ),
  },
  {
    key: "actions",
    header: "Azioni",
    align: "end",
    render: (qr) => <QrQuickActions qr={qr} actions={actions} />,
  },
];

function SelectCell({ qr }: { qr: QrCode }) {
  const selection = useSelection();
  if (!selection) return null;
  return (
    <span className={styles.selectCell}>
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          checked={selection.selected.has(qr.id)}
          onChange={() => selection.toggle(qr.id)}
        />
        <span className="visually-hidden">Seleziona {qr.name}</span>
      </label>
      <DragHandle id={qr.id} label={qr.name} />
    </span>
  );
}

function TagsCell({ qr }: { qr: QrCode }) {
  const selection = useSelection();
  return selection ? <TagDots tags={selection.tags} ids={qr.tag_ids} /> : null;
}

const selectColumn = (): Column<QrCode> => ({
  key: "select",
  header: "",
  mobileLabel: false,
  render: (qr) => <SelectCell qr={qr} />,
});

export function QrTable({
  rows,
  base,
  actions,
}: {
  rows: QrCode[];
  base: string;
  actions: QrActions;
}) {
  return (
    <Table
      caption="Codici QR"
      columns={columnsFor(base, actions, true)}
      rows={rows}
      rowKey={(qr) => qr.id}
    />
  );
}
