import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { StatusPage } from "@/components/layout/StatusPage";
import { Suspended } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui";
import { requireUser } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Account sospeso" };
export const dynamic = "force-dynamic";

/** The only way to be blocked is a suspension by the team (abuse, terms). Money never blocks. */
export default async function SuspendedPage() {
  const me = await requireUser();
  if (me.workspace?.access !== "suspended") redirect("/");
  const subject = encodeURIComponent("Account Vorya QR sospeso");
  return (
    <StatusPage
      title="Account sospeso"
      illustration={<Suspended />}
      actions={
        <>
          <ButtonLink href={`mailto:${me.support_email}?subject=${subject}`}>
            Contatta il supporto
          </ButtonLink>
          <LogoutButton />
        </>
      }
    >
      <p>
        L’account è stato sospeso. I codici QR dinamici non sono attivi finché l’account non viene
        riattivato.
      </p>
    </StatusPage>
  );
}
