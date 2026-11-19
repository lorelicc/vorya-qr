import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { LegalFooter } from "./LegalFooter";
import styles from "./StatusPage.module.css";

/** Centered branded card for system pages (suspended, access denied, not found). */
export function StatusPage({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.bar} />
        <Brand />
        <h1>{title}</h1>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </main>
      <LegalFooter />
    </div>
  );
}
