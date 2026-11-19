import { requireCustomer } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return children;
}
