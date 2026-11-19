"use client";
import { TriangleAlert } from "lucide-react";
import { StaticWarning } from "@/components/illustrations";
import { Button } from "@/components/ui";
import styles from "./StaticNotice.module.css";

/**
 * Red notice for static QR codes. The live region stays mounted so screen readers announce it
 * when it appears; the text carries the meaning (never only the colour).
 */
export function StaticNotice({ show, onUseDynamic }: { show: boolean; onUseDynamic?: () => void }) {
  return (
    <div role="status" aria-live="polite" className={styles.region}>
      {show && (
        <div className={styles.box} data-testid="static-notice">
          <div className={styles.art}>
            <StaticWarning />
          </div>
          <div className={styles.body}>
            <p className={styles.title}>
              <TriangleAlert size={18} aria-hidden="true" />
              <strong>Attenzione</strong>
            </p>
            <p>
              Questo QR è statico: il contenuto viene scritto direttamente nel codice. Una volta
              stampato o condiviso <strong>NON potrà più essere modificato</strong> e non potrai
              vederne le statistiche.
            </p>
            {onUseDynamic && (
              <Button variant="secondary" onClick={onUseDynamic}>
                Usa la versione dinamica
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
