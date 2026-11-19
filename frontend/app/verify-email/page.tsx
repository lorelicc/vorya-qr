import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export const metadata: Metadata = { title: "Conferma email" };

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Scegli la password"
      intro="Ultimo passaggio: scegli una password per attivare la prova."
    >
      <SetPasswordForm
        endpoint="auth/verify-email"
        submitLabel="Attiva la prova"
        successHref="/app"
        missingLinkHref="/register"
      />
    </AuthLayout>
  );
}
