import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Prova gratuita" };

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Prova Vorya QR"
      intro="14 giorni gratuiti con i limiti del piano Pro. Nessuna carta richiesta: ti mandiamo un link per confermare l’email e scegliere la password."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
