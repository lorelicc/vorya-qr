import type { ReactNode } from "react";
import { AuthArtwork } from "@/components/illustrations";
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
        <AuthArtwork />
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
