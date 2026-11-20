import Link from "next/link";
import styles from "./Brand.module.css";

/** Official PNGs only (vorya_qr.png is a placeholder until the final artwork arrives). */
export function Brand({
  compact = false,
  href = "/",
  tone = "dark",
}: {
  compact?: boolean;
  href?: string;
  /** "light" = white "vorya" lettering, for dark backgrounds (footer, dark sections). */
  tone?: "dark" | "light";
}) {
  return (
    <Link href={href} className={styles.brand} aria-label="Vorya QR, home">
      {compact ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.compact}
          src="/assets/branding/vorya_v.png"
          alt=""
          width={40}
          height={40}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.full}
          src={
            tone === "light"
              ? "/assets/branding/vorya_qr_white.png"
              : "/assets/branding/vorya_qr.png"
          }
          alt=""
          width={185}
          height={42}
        />
      )}
    </Link>
  );
}
