import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PasswordGate } from "@/components/illustrations";
import { StatusPage } from "@/components/layout/StatusPage";
import { UnlockForm } from "@/components/links/UnlockForm";

export const metadata: Metadata = { title: "Link protetto", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Reached by rewrite from /r/{slug} or /{alias}: the address bar keeps the short link. */
export default async function UnlockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9]{7}$/.test(slug)) notFound();
  return (
    <StatusPage title="Link protetto" illustration={<PasswordGate />}>
      <p>Chi ha creato questo link ha impostato una password. Inseriscila per continuare.</p>
      <UnlockForm slug={slug} />
    </StatusPage>
  );
}
