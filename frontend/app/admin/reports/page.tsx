import type { Metadata } from "next";
import { ReportList } from "@/components/admin/ReportList";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Segnalazioni" };

export default async function Page() {
  const me = await requireAdmin();
  return <ReportList canWrite={me.role === "super_admin"} />;
}
