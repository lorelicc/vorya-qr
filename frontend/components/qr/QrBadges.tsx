import { Badge } from "@/components/ui";
import type { QrCode } from "@/lib/types";

export function KindBadge({ kind }: { kind: QrCode["kind"] }) {
  return kind === "dynamic" ? <Badge tone="info">Dinamico</Badge> : <Badge>Statico</Badge>;
}

export function StatusBadge({ qr }: { qr: Pick<QrCode, "kind" | "status"> }) {
  if (qr.kind === "static") return <Badge tone="success">Sempre attivo</Badge>;
  if (qr.status === "blocked") return <Badge tone="danger">Bloccato</Badge>;
  return qr.status === "active" ? (
    <Badge tone="success">Attivo</Badge>
  ) : (
    <Badge tone="warning">In pausa</Badge>
  );
}
