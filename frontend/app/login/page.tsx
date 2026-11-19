import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { optionalUser } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Accedi" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const me = await optionalUser();
  if (me) redirect(me.role === "company_admin" ? "/app" : "/admin");
  const { next } = await searchParams;
  return (
    <AuthLayout title="Bentornato" intro="Accedi per gestire i tuoi codici QR.">
      <LoginForm next={next} />
    </AuthLayout>
  );
}
