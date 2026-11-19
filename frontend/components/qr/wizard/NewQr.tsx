"use client";
import { useEffect, useState } from "react";
import { SkeletonList } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { QrCode } from "@/lib/types";
import { QrWizard } from "./QrWizard";

/** /qr/new, or /qr/new?from=ID ("Duplica e modifica": a NEW QR prefilled from a static one). */
export function NewQr({ fromId }: { fromId: number | null }) {
  const { api: base } = useCompany();
  const [source, setSource] = useState<QrCode | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!fromId) return;
    api<QrCode>(`${base}/qr-codes/${fromId}`)
      .then(setSource)
      .catch((err) => setError(errorMessage(err)));
  }, [base, fromId]);
  if (error) return <p role="alert">{error}</p>;
  if (fromId && !source) return <SkeletonList rows={3} />;
  return <QrWizard source={source ?? undefined} />;
}
