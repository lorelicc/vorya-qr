import type { Metadata } from "next";
import { AccountPlan } from "@/components/billing/AccountPlan";

export const metadata: Metadata = { title: "Piano e utilizzo" };

export default function PlanPage() {
  return <AccountPlan />;
}
