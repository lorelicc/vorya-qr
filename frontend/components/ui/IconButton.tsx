import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  tone?: "default" | "danger";
};

/** Square icon button; `label` is mandatory and becomes the accessible name and tooltip. */
export function IconButton({
  label,
  children,
  tone = "default",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`${styles.iconButton} ${tone === "danger" ? styles.danger : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
