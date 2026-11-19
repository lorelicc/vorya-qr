import Link from "next/link";
import type { BillingInfo } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import styles from "./billing.module.css";

/** Plain-language notice for payment problems; nothing is shown when everything is fine. */
export function BillingBanner({ info }: { info: BillingInfo }) {
  if (info.state === "past_due" && info.grace_until)
    return (
      <div className={styles.banner} data-tone="warning" role="status">
        <span>
          Il pagamento del rinnovo non è andato a buon fine. Aggiorna il metodo di pagamento entro
          il {formatDate(info.grace_until)}: fino ad allora il servizio resta attivo.
        </span>
      </div>
    );
  if ((info.state === "canceled" || info.state === "unpaid") && info.redirects_until)
    return (
      <div className={styles.banner} data-tone="danger" role="status">
        <span>
          L’abbonamento non è attivo. I tuoi QR e link continuano a funzionare fino al{" "}
          {formatDate(info.redirects_until)}. Scegli un piano per riattivare tutto subito.
        </span>
      </div>
    );
  return null;
}

export function PastDueNotice() {
  return (
    <div className={styles.banner} data-tone="warning" role="status">
      <span>Il pagamento del rinnovo non è riuscito.</span>
      <Link href="/account/plan">Aggiorna il pagamento</Link>
    </div>
  );
}
