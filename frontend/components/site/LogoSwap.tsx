import Link from "next/link";
import styles from "./header.module.css";

/** Logo with both versions stacked: they cross-fade when the header changes colour. */
export function LogoSwap({ dark }: { dark: boolean }) {
  return (
    <Link
      href="/"
      className={styles.logo}
      aria-label="Vorya QR, home"
      data-dark={dark || undefined}
    >
      {/* eslint-disable @next/next/no-img-element */}
      <img src="/assets/branding/vorya_qr.png" alt="" width={185} height={42} />
      <img src="/assets/branding/vorya_qr_white.png" alt="" width={185} height={42} />
      {/* eslint-enable @next/next/no-img-element */}
    </Link>
  );
}
