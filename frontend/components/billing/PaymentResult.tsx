"use client";
import { useEffect, useState } from "react";
import { PaymentKo, PaymentOk } from "@/components/illustrations";
import { StatusPage } from "@/components/layout/StatusPage";
import { ButtonLink } from "@/components/ui";
import { api } from "@/lib/api";

/** Success page: asks the server to re-read the subscription in case the webhook is late. */
export function PaymentSuccess() {
  const [state, setState] = useState<string | null>(null);
  useEffect(() => {
    api<{ state: string }>("account/billing/refresh", "POST")
      .then((r) => setState(r.state))
      .catch(() => setState("unknown"));
  }, []);
  const active = state === "active";
  return (
    <StatusPage
      title="Pagamento ricevuto"
      illustration={<PaymentOk />}
      actions={<ButtonLink href="/companies">Vai alle tue aziende</ButtonLink>}
    >
      <p role="status">
        {active || state === null
          ? "Grazie! Il tuo piano è attivo: i nuovi limiti valgono subito. Ti abbiamo inviato una email di conferma."
          : "Grazie! Stiamo confermando il pagamento: il piano si attiva in pochi istanti. Se non vedi cambiamenti, ricarica la pagina del tuo piano."}
      </p>
    </StatusPage>
  );
}

export function PaymentCancelled() {
  return (
    <StatusPage
      title="Pagamento non completato"
      illustration={<PaymentKo />}
      actions={
        <>
          <ButtonLink href="/account/plan">Riprova</ButtonLink>
          <ButtonLink href="/companies" variant="secondary">
            Torna alle aziende
          </ButtonLink>
        </>
      }
    >
      <p>Non è stato addebitato nulla. Puoi riprovare quando vuoi, il tuo piano non è cambiato.</p>
    </StatusPage>
  );
}
