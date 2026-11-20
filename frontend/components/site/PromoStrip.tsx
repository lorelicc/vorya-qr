import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import type { SiteOffer } from "@/lib/site/offer";
import styles from "./header.module.css";

/** Coloured strip above the header. Text, link and colour come from the admin settings. */
export function PromoStrip({ offer }: { offer: SiteOffer | null }) {
  const banner = offer?.banner;
  if (!banner?.enabled || !banner.text) return null;
  return (
    <aside className={styles.strip} data-tone={banner.tone} aria-label="Offerta">
      <div className={styles.stripInner}>
        <Sparkles size={16} aria-hidden="true" />
        <span>{banner.text}</span>
        <Link href={banner.href} data-umami-event="striscia-promo">
          {banner.cta} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
