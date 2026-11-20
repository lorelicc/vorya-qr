import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ReportToken } from "@/components/report/ReportToken";

export const metadata: Metadata = { title: "Conferma i report", robots: { index: false } };

export default function Page() {
  return (
    <AuthLayout title="Conferma i report">
      <ReportToken action="confirm" />
    </AuthLayout>
  );
}
