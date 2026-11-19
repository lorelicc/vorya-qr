import type { Metadata } from "next";
import { PlanList } from "@/components/admin/PlanList";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Piani" };

export default async function PlansPage() {
  const me = await requireAdmin();
  return <PlanList canWrite={me.role === "super_admin"} />;
}
