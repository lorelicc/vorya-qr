import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { StatusPage } from "@/components/layout/StatusPage";
import { PlanCanceled, Suspended, TrialExpired } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui";
import { requireUser } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Account non attivo" };
export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const me = await requireUser();
  const access = me.workspace?.access;
  if (access !== "trial_expired" && access !== "suspended" && access !== "payment_blocked")
    redirect("/");
  const expired = access === "trial_expired";
  const lapsed = access === "payment_blocked";
  const subject = encodeURIComponent(
    expired ? "Attivazione piano Vorya QR" : "Account Vorya QR sospeso",
  );
  return (
    <StatusPage
      title={lapsed ? "Abbonamento non attivo" : expired ? "Prova terminata" : "Account sospeso"}
      illustration={lapsed ? <PlanCanceled /> : expired ? <TrialExpired /> : <Suspended />}
      actions={
        <>
          {expired || lapsed ? (
            <ButtonLink href="/account/plan">Scegli un piano</ButtonLink>
          ) : (
            <ButtonLink href={`mailto:${me.support_email}?subject=${subject}`}>
              Contatta il supporto
            </ButtonLink>
          )}
          <LogoutButton />
        </>
      }
    >
      {lapsed ? (
        <p>
          L’abbonamento non è attivo. Per un periodo limitato i tuoi QR e link continuano a
          funzionare; scegli un piano per riprendere a modificarli. Il pagamento riattiva tutto
          subito.
        </p>
      ) : expired ? (
        <p>
          Il periodo di prova è terminato: scegli un piano per continuare a modificare i tuoi QR. I
          QR dinamici già pubblicati continuano a funzionare per un periodo limitato.
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
