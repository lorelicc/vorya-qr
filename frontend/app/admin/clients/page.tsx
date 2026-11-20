import type { Metadata } from "next";
import { ClientList } from "@/components/admin/ClientList";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Clienti" };

export default async function Page() {
  const me = await requireAdmin();
  return <ClientList canWrite={me.role === "super_admin"} />;
}
