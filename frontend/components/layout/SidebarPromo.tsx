import type { ReactNode } from "react";
import styles from "./SidebarPromo.module.css";

/** Gradient card in the sidebar, as in Vorya Sign. */
export function SidebarPromo({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className={styles.promo}>
      <h3>{title}</h3>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </section>
  );
}
