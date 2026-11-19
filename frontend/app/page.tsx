import { redirect } from "next/navigation";
import { optionalUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await optionalUser();
  if (!me) redirect("/login");
  redirect(me.role === "company_admin" ? "/app" : "/admin");
}
