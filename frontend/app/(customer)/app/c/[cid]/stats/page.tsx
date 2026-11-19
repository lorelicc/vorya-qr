import type { Metadata } from "next";
import { CompanyStatsView } from "@/components/stats/CompanyStatsView";

export const metadata: Metadata = { title: "Statistiche" };

export default function CompanyStatsPage() {
  return <CompanyStatsView />;
}
