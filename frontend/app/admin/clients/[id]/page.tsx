import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/admin/ClientDetail";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Cliente" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <ClientDetail id={id} canWrite={me.role === "super_admin"} />;
}
