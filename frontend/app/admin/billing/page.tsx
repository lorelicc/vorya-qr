import type { Metadata } from "next";
import { BillingAdmin } from "@/components/admin/BillingAdmin";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Pagamenti" };

export default async function Page() {
  const me = await requireAdmin();
  return <BillingAdmin canWrite={me.role === "super_admin"} />;
}
