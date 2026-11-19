import { Link2 } from "lucide-react";
import type { QrCode } from "@/lib/types";
import styles from "./QrList.module.css";

/** QR miniature from the same SVG renderer as the exports (lazy, cache-busted on update). */
export function QrThumb({ qr, src, size = 56 }: { qr: QrCode; src: string; size?: number }) {
  if (!qr.has_qr)
    return (
      <span className={styles.linkThumb} style={{ width: size, height: size }} aria-hidden="true">
        <Link2 size={Math.round(size * 0.42)} />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated SVG from our API
    <img
      className={styles.thumb}
      src={`${src}?v=${encodeURIComponent(qr.updated_at)}`}
      width={size}
      height={size}
      loading="lazy"
      alt=""
    />
  );
}
