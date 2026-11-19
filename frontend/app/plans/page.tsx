import type { Metadata } from "next";
import Link from "next/link";
import { PlansPage } from "@/components/billing/PlansPage";
import { Brand } from "@/components/layout/Brand";
import { LegalFooter } from "@/components/layout/LegalFooter";
import { optionalUser } from "@/lib/auth-server";

export const metadata: Metadata = { title: "Piani e prezzi" };
export const dynamic = "force-dynamic";

export default async function Plans() {
  const me = await optionalUser();
  const customer = me?.role === "company_admin";
  return (
    <>
      <main className="page" style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
        <Brand href={customer ? "/companies" : "/"} />
        <div className="page-header">
          <div>
            <h1>Piani e prezzi</h1>
            <p>
              Link brevi e QR dinamici per la tua azienda. Parti con la prova gratuita, scegli il
              piano quando vuoi.
            </p>
          </div>
          {customer && <Link href="/account/plan">Il tuo piano</Link>}
        </div>
        <PlansPage loggedIn={customer} />
      </main>
      <LegalFooter />
    </>
  );
}
