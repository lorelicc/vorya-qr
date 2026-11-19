import type { Metadata } from "next";
import { PlanOverview } from "@/components/account/PlanOverview";

export const metadata: Metadata = { title: "Piano e utilizzo" };

export default function PlanPage() {
  return <PlanOverview />;
}
