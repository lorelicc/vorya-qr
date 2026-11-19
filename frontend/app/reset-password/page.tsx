import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export const metadata: Metadata = { title: "Nuova password" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Nuova password"
      intro="Scegli una nuova password. Le sessioni aperte verranno chiuse."
    >
      <SetPasswordForm
        endpoint="auth/reset-password"
        submitLabel="Salva la password"
        successHref="/login"
        missingLinkHref="/forgot-password"
      />
    </AuthLayout>
  );
}
