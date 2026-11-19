import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QrDetail } from "@/components/qr/QrDetail";

export const metadata: Metadata = { title: "Modifica QR" };

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <QrDetail id={id} />;
}
