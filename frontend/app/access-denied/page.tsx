import type { Metadata } from "next";
import { StatusPage } from "@/components/layout/StatusPage";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Accesso negato" };

export default function AccessDeniedPage() {
  return (
    <StatusPage title="Accesso negato" actions={<ButtonLink href="/">Torna alla home</ButtonLink>}>
      <p>Il tuo account non dispone dei permessi per questa pagina.</p>
    </StatusPage>
  );
}
