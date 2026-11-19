import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkspaceDetail } from "@/components/admin/WorkspaceDetail";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Spazio di lavoro" };

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const me = await requireAdmin();
  return <WorkspaceDetail id={id} canWrite={me.role === "super_admin"} />;
}
