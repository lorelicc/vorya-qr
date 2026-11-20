import type { Metadata } from "next";
import { SiteOfferAdmin } from "@/components/admin/SiteOfferAdmin";
import { requireAdmin } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Sito" };

export default async function Page() {
  const me = await requireAdmin();
  return <SiteOfferAdmin canWrite={me.role === "super_admin"} />;
}
