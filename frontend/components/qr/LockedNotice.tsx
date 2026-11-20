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
 * Above the plan limits an element is read-only, never switched off: it keeps working and
 * counting scans. Said plainly, with the way out.
 */
export function LockedNotice({ qr }: { qr: Pick<QrCode, "locked_reason"> }) {
  return (
    <div className={styles.notice} role="status" data-testid="locked-notice">
      <Lock size={18} aria-hidden="true" />
      <div>
        <strong>In sola lettura.</strong> {REASONS[qr.locked_reason ?? ""] ?? ""} Il codice{" "}
        <strong>continua a funzionare</strong> e a registrare le scansioni: per modificarlo passa a
        un piano superiore oppure elimina altri codici.
        <div style={{ marginTop: "var(--space-2)" }}>
          <ButtonLink href="/account/plan" variant="secondary">
            Vedi i piani
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
