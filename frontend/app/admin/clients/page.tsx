import type { Metadata } from "next";
import { ClientList } from "@/components/admin/ClientList";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Clienti" };

export default async function Page() {
  await requireAdmin();
  return <ClientList />;
}
