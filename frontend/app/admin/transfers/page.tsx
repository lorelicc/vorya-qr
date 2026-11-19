import type { Metadata } from "next";
import { TransferList } from "@/components/admin/TransferList";

export const metadata: Metadata = { title: "Trasferimenti" };

export default function Page() {
  return <TransferList />;
}
