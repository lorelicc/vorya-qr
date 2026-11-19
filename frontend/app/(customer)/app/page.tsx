import type { Metadata } from "next";
import { Dashboard } from "@/components/qr/Dashboard";

export const metadata: Metadata = { title: "Codici QR" };

export default function DashboardPage() {
  return <Dashboard />;
}
