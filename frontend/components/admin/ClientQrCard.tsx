"use client";
import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, Table, useToast, type Column } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { AdminQr } from "@/lib/admin-clients";
import { formatDate, formatNumber } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks";

const STATUS: Record<AdminQr["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Attivo", tone: "success" },
  paused: { label: "In pausa", tone: "warning" },
  blocked: { label: "Bloccato", tone: "danger" },
  deleted: { label: "Eliminato", tone: "neutral" },
}; // prettier-ignore

/** The customer's QR codes, with the admin actions: block, unblock, delete. */
export function ClientQrCard({ clientId, canWrite }: { clientId: number; canWrite: boolean }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search);
  const [data, setData] = useState<{ total: number; items: AdminQr[] } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api<{ total: number; items: AdminQr[] }>(
      `admin/clients/${clientId}/qr-codes?${new URLSearchParams({ search: term })}`,
    ).then(setData, (err) => toast.show(errorMessage(err), "error"));
  }, [clientId, term, tick, toast]);

  const act = useCallback(
    async (qr: AdminQr, action: "block" | "unblock" | "delete") => {
      if (
        action === "delete" &&
        !window.confirm(`Eliminare «${qr.name}»? L’indirizzo resta riservato.`)
      )
        return;
      try {
        await api(`admin/clients/${clientId}/qr-codes/${qr.id}/${action}`, "POST", {});
        toast.show("Fatto.");
        setTick((n) => n + 1);
      } catch (err) {
        toast.show(errorMessage(err), "error");
      }
    },
    [clientId, toast],
  );

  const columns: Column<AdminQr>[] = [
    { key: "name", header: "QR", mobileLabel: false, render: (q) => (<div><strong>{q.name}</strong><br /><small className="muted">/{q.slug} · {q.company}</small></div>) },
    { key: "kind", header: "Tipo", render: (q) => (q.kind === "dynamic" ? "Dinamico" : "Statico") },
    { key: "status", header: "Stato", render: (q) => (<Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>) },
    { key: "scans", header: "Scansioni", align: "end", render: (q) => formatNumber(q.scan_total) },
    { key: "created", header: "Creato", align: "end", render: (q) => formatDate(q.created_at) },
    {
      key: "actions", header: "", align: "end",
      render: (q) => !canWrite || q.status === "deleted" ? null : (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          {q.status === "blocked" ? (
            <Button variant="secondary" icon={<CheckCircle2 size={14} />} onClick={() => act(q, "unblock")}>Sblocca</Button>
          ) : (
            <Button variant="secondary" icon={<Ban size={14} />} onClick={() => act(q, "block")}>Blocca</Button>
          )}
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => act(q, "delete")}>Elimina</Button>
        </div>
      ),
    },
  ]; // prettier-ignore

  return (
    <Card
      title={`QR code${data ? ` (${data.total})` : ""}`}
      description="Tutti i codici del cliente: puoi bloccarli (mostrano «QR non attivo») o eliminarli."
    >
      <div className="stack">
        <Input
          label="Cerca per nome o indirizzo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Table
          caption="QR code del cliente"
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(q) => q.id}
          empty={<p className="muted">Nessun QR.</p>}
        />
      </div>
    </Card>
  );
}
