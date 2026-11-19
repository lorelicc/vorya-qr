"use client";
import { QrCode as QrIcon } from "lucide-react";
import { useState } from "react";
import { Button, Card, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";

/** A short link becomes printable: same slug, so links already shared keep working. */
export function GenerateQrCard({ qr, onDone }: { qr: QrCode; onDone: (qr: QrCode) => void }) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true);
    try {
      onDone(await api<QrCode>(`${base}/qr-codes/${qr.id}/generate-qr`, "POST"));
      toast.show("QR generato: stesso link, ora anche da stampare.");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card
      title="QR"
      description="Questo link non ha ancora un QR. Il QR userà lo stesso link: chi lo ha già ricevuto non nota differenze."
    >
      <Button icon={<QrIcon size={16} />} loading={busy} onClick={generate}>
        Genera QR
      </Button>
    </Card>
  );
}
