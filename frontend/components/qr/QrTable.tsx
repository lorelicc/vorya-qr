import { BarChart3, Pencil } from "lucide-react";
import Link from "next/link";
import { Table, type Column } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { QrCode } from "@/lib/types";
import { KindBadge, StatusBadge } from "./QrBadges";
import styles from "./QrTable.module.css";

const columnsFor = (base: string): Column<QrCode>[] => [
  {
    key: "name",
    header: "Nome",
    mobileLabel: false,
    render: (qr) => (
      <div className={styles.name}>
        <Link href={`${base}/qr/${qr.id}`}>{qr.name}</Link>
        <span className={styles.url} title={qr.target_url}>
          {qr.target_url}
        </span>
      </div>
    ),
  },
  { key: "kind", header: "Tipo", render: (qr) => <KindBadge kind={qr.kind} /> },
  { key: "status", header: "Stato", render: (qr) => <StatusBadge qr={qr} /> },
  {
    key: "scans",
    header: "Scansioni",
    align: "end",
    render: (qr) =>
      qr.kind === "dynamic" ? formatNumber(qr.scan_count) : <span className="muted">n/d</span>,
  },
  {
    key: "actions",
    header: "Azioni",
    align: "end",
    render: (qr) => (
      <div className={styles.actions}>
        <Link href={`${base}/qr/${qr.id}`} aria-label={`Modifica ${qr.name}`} title="Modifica">
          <Pencil size={16} />
        </Link>
        {qr.kind === "dynamic" && (
          <Link
            href={`${base}/qr/${qr.id}/stats`}
            aria-label={`Statistiche di ${qr.name}`}
            title="Statistiche"
          >
            <BarChart3 size={16} />
          </Link>
        )}
      </div>
    ),
  },
];

export function QrTable({ rows, base }: { rows: QrCode[]; base: string }) {
  return (
    <Table caption="Codici QR" columns={columnsFor(base)} rows={rows} rowKey={(qr) => qr.id} />
  );
}
