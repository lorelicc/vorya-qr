import type { Metadata } from "next";
import { CompanySettings } from "@/components/companies/CompanySettings";

export const metadata: Metadata = { title: "Impostazioni azienda" };

export default function SettingsPage() {
  return <CompanySettings />;
}
