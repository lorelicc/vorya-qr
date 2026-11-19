import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { StatusPage } from "@/components/layout/StatusPage";
import { ButtonLink } from "@/components/ui";
import { requireUser } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Account non attivo" };
export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const me = await requireUser();
  const access = me.workspace?.access;
  if (access !== "trial_expired" && access !== "suspended") redirect("/");
  const expired = access === "trial_expired";
  const subject = encodeURIComponent(
    expired ? "Attivazione piano Vorya QR" : "Account Vorya QR sospeso",
  );
  return (
    <StatusPage
      title={expired ? "Prova terminata" : "Account sospeso"}
      actions={
        <>
          <ButtonLink href={`mailto:${me.support_email}?subject=${subject}`}>
            {expired ? "Contattaci per attivare un piano" : "Contatta il supporto"}
          </ButtonLink>
          <LogoutButton />
        </>
      }
    >
      {expired ? (
        <p>
          Il periodo di prova è terminato, contattaci per attivare un piano. I tuoi QR dinamici
          continuano a funzionare e a registrare le scansioni.
        </p>
      ) : (
        <p>
          L’account è stato sospeso. I codici QR dinamici non sono attivi finché l’account non viene
          riattivato.
        </p>
      )}
    </StatusPage>
  );
}
