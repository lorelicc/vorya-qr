import type { Metadata } from "next";
import { ReservedWords } from "@/components/admin/ReservedWords";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Parole riservate" };

export default async function Page() {
  const me = await requireAdmin();
  return <ReservedWords canWrite={me.role === "super_admin"} />;
}
