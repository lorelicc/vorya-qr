import type { Metadata } from "next";
import { BlockedDomains } from "@/components/admin/BlockedDomains";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Domini bloccati" };

export default async function Page() {
  const me = await requireAdmin();
  return <BlockedDomains canWrite={me.role === "super_admin"} />;
}
