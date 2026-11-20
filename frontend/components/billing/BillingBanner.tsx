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
  if (info.state === "free" || info.state === "canceled" || info.state === "unpaid")
    return (
      <div className={styles.banner} data-tone="info" role="status">
        <span>
          Sei sul piano <strong>Free</strong>: restano attivi i codici che rientrano nei limiti del
          Free, senza pubblicità. Gli altri QR dinamici sono sospesi finché non scegli un piano o ne
          elimini alcuni; non viene cancellato nulla.
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
