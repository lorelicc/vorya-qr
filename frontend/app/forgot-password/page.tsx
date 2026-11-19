import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Password dimenticata" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Password dimenticata"
      intro="Inserisci l’email del tuo account: ti invieremo un link valido 30 minuti."
    >
      <ForgotForm />
    </AuthLayout>
  );
}
