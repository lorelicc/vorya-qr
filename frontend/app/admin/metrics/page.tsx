import type { Metadata } from "next";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Metriche" };

export default async function Page() {
  await requireAdmin();
  return <AdminMetrics />;
}
