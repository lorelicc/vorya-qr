import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatsView } from "@/components/stats/StatsView";

export const metadata: Metadata = { title: "Statistiche" };

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <StatsView id={id} />;
}
