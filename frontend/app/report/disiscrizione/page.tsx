import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ReportToken } from "@/components/report/ReportToken";

export const metadata: Metadata = { title: "Disiscrizione dai report", robots: { index: false } };

export default function Page() {
  return (
    <AuthLayout title="Disiscrizione dai report">
      <ReportToken action="unsubscribe" />
    </AuthLayout>
  );
}
