import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

type Props = HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  padding?: "md" | "lg";
  /** Hover lift and a small scale-down on tap (for clickable cards). */
  interactive?: boolean;
};

export function Card({
  title,
  description,
  actions,
  padding = "md",
  interactive = false,
  children,
  className,
  ...props
}: Props) {
  return (
    <section
      className={[styles.card, styles[padding], interactive ? styles.interactive : "", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {(title || actions) && (
        <header className={styles.header}>
          <div>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
