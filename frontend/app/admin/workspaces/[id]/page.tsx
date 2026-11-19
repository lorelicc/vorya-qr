import { redirect } from "next/navigation";

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/clients/${(await params).id}`);
}
