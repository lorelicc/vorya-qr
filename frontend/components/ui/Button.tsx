import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Common = { variant?: ButtonVariant; icon?: ReactNode; block?: boolean };

export function buttonClass({ variant = "primary", block }: Common) {
  return [styles.button, styles[variant], block ? styles.block : ""].filter(Boolean).join(" ");
}

export function Button({
  variant,
  icon,
  block,
  loading = false,
  children,
  disabled,
  type = "button",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Common & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={[buttonClass({ variant, block }), className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  icon,
  block,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & Common & { href: string }) {
  return (
    <Link href={href} className={buttonClass({ variant, block })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
