import type { Metadata } from "next";
import { PaymentCancelled } from "@/components/billing/PaymentResult";
import { requireBillingCustomer } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Pagamento" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireBillingCustomer();
  return <PaymentCancelled />;
}
