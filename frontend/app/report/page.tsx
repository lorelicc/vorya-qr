import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ReportForm } from "@/components/report/ReportForm";

export const metadata: Metadata = { title: "Segnala un QR", robots: { index: false } };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string; slug?: string }>;
}) {
  const params = await searchParams;
  const link = params.link ?? params.slug;
  return (
    <AuthLayout
      title="Segnala un QR sospetto"
      intro="Un QR creato con Vorya QR porta a una truffa, a un virus o a contenuti illegali? Segnalacelo: il team lo verifica e, se serve, lo blocca."
    >
      <ReportForm initialLink={typeof link === "string" ? link.slice(0, 300) : ""} />
    </AuthLayout>
  );
}
