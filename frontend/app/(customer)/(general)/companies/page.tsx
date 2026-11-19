import type { Metadata } from "next";
import { Suspense } from "react";
import { CompaniesPage } from "@/components/companies/CompaniesPage";
import { SkeletonList } from "@/components/ui";

export const metadata: Metadata = { title: "Aziende" };

export default function Companies() {
  return (
    <Suspense fallback={<SkeletonList rows={3} />}>
      <CompaniesPage />
    </Suspense>
  );
}
