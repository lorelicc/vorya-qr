import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth-server";

/** Entry point after login: the last company used, or the company list. */
export default async function AppHome() {
  const me = await requireCustomer();
  redirect(me.last_company_id ? `/app/c/${me.last_company_id}` : "/companies");
}
