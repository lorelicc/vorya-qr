import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  icon?: ReactNode;
  illustration?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, illustration, title, description, action }: Props) {
  return (
    <div className={styles.empty}>
      {illustration ? (
        <div className={styles.illustration}>{illustration}</div>
      ) : (
        icon && <div className={styles.icon}>{icon}</div>
      )}
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
