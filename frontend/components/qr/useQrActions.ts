"use client";
import { useState } from "react";
import { useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";

/** Quick actions shared by the card and list views of the dashboard. */
export function useQrActions(onCreated: (qr: QrCode) => void, onUpdated: (qr: QrCode) => void) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  async function run(qr: QrCode, action: "duplicate" | "pause" | "resume" | "generate-qr") {
    setBusy(qr.id);
    try {
      const result = await api<QrCode>(`${base}/qr-codes/${qr.id}/${action}`, "POST");
      if (action === "duplicate") {
        onCreated(result);
        toast.show(`Creato «${result.name}».`);
      } else if (action === "generate-qr") {
        onUpdated({ ...qr, has_qr: true });
        toast.show("QR generato: stesso link, ora anche da stampare.");
      } else {
        onUpdated({ ...qr, status: result.status });
        toast.show(action === "pause" ? "QR in pausa." : "QR riattivato.");
      }
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    duplicate: (qr: QrCode) => run(qr, "duplicate"),
    generateQr: (qr: QrCode) => run(qr, "generate-qr"),
    toggle: (qr: QrCode) => run(qr, qr.status === "paused" ? "resume" : "pause"),
    image: (qr: QrCode, ext: "svg" | "png") =>
      `/api/${base}/qr-codes/${qr.id}/image.${ext}${ext === "png" ? "?size=1024" : ""}`,
  };
}

export type QrActions = ReturnType<typeof useQrActions>;
