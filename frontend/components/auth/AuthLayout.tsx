import type { ReactNode } from "react";
import { Brand } from "@/components/layout/Brand";
import styles from "./AuthLayout.module.css";

/** Split screen like Vorya Sign: gradient artwork on one side, the form on the other. */
export function AuthLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <section className={styles.art} aria-hidden="true">
        <div className={styles.artCard}>
          <div className={styles.qr}>
            {Array.from({ length: 49 }, (_, i) => (
              <i key={i} className={PATTERN.has(i) ? styles.on : undefined} />
            ))}
          </div>
          <div className={styles.lines}>
            <b />
            <i />
            <i />
          </div>
        </div>
        <p className={styles.claim}>
          Codici QR statici e dinamici,
          <br />
          una sola identità.
        </p>
      </section>
      <section className={styles.panel}>
        <div className={styles.form}>
          <Brand />
          <h1>{title}</h1>
          {intro && <p className={styles.intro}>{intro}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}

// Decorative 7x7 "QR-like" pattern (three finder corners plus a few modules).
const PATTERN = new Set([
  0, 1, 2, 7, 9, 14, 15, 16, 4, 5, 6, 11, 13, 18, 19, 20, 28, 29, 30, 35, 37, 42, 43, 44, 24, 32,
  40, 46, 26,
]);
