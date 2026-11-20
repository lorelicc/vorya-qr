import { Lock } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import type { QrCode } from "@/lib/types";
import styles from "./LockedNotice.module.css";

const REASONS: Record<string, string> = {
  company: "Questa azienda è oltre il limite del tuo piano.",
  quota: "Il tuo piano include meno codici dinamici per azienda di quelli che hai creato.",
  type: "Il tipo di questo codice non è incluso nel tuo piano.",
};

/**
 * Above the plan limits a dynamic code is suspended (scans show "QR non attivo") and cannot be
 * edited; a code whose TYPE is not in the plan stays active but read-only. Nothing is deleted.
 */
export function LockedNotice({ qr }: { qr: Pick<QrCode, "locked_reason"> }) {
  const suspended = qr.locked_reason !== "type";
  return (
    <div className={styles.notice} role="status" data-testid="locked-notice">
      <Lock size={18} aria-hidden="true" />
      <div>
        <strong>{suspended ? "Sospeso." : "In sola lettura."}</strong>{" "}
        {REASONS[qr.locked_reason ?? ""] ?? ""}{" "}
        {suspended ? (
          <>
            Chi lo scansiona vede <strong>«QR non attivo»</strong>. Si riattiva subito se passi a un
            piano superiore o elimini altri codici; non viene cancellato nulla.
          </>
        ) : (
          <>
            Resta <strong>attivo</strong> e continua a registrare le scansioni: per modificarlo
            passa a un piano superiore.
          </>
        )}
        <div style={{ marginTop: "var(--space-2)" }}>
          <ButtonLink href="/account/plan" variant="secondary">
            Vedi i piani
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
