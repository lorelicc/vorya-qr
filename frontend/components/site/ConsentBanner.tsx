"use client";
import Link from "next/link";
import Script from "next/script";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";
import styles from "./consent.module.css";

/**
 * Cookie banner + Google Consent Mode v2, for the Google Ads conversion tag ONLY. Everything is
 * off by default: with NEXT_PUBLIC_ADS_ENABLED != "true" this renders nothing and no Google
 * script is ever requested. Analytics (Umami) needs no banner: no cookies.
 */
const KEY = "vorya_consent";
type Choice = "granted" | "denied" | null;
const read = (): Choice => {
  try {
    return localStorage.getItem(KEY) as Choice;
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  window.addEventListener("vorya-consent", cb);
  return () => window.removeEventListener("vorya-consent", cb);
};

export function ConsentBanner() {
  const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
  const id = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const choice = useSyncExternalStore(subscribe, read, () => null as Choice);
  const [, force] = useState(0);
  if (!enabled || !id) return null;

  const decide = (value: "granted" | "denied") => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode: the choice is just not remembered */
    }
    window.dispatchEvent(new Event("vorya-consent"));
    force((n) => n + 1);
  };

  return (
    <>
      <Script id="consent-default" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`}
      </Script>
      {choice === "granted" && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
            strategy="afterInteractive"
          />
          <Script id="ads-config" strategy="afterInteractive">
            {`gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});gtag('js',new Date());gtag('config','${id}');`}
          </Script>
        </>
      )}
      {choice === null && (
        <div className={styles.banner} role="dialog" aria-label="Preferenze cookie">
          <p>
            Usiamo un cookie di Google Ads solo per misurare le campagne pubblicitarie. Puoi
            rifiutare: il sito funziona allo stesso modo. Vedi la{" "}
            <Link href="/legal/cookie">Cookie policy</Link>.
          </p>
          <div>
            <Button variant="secondary" onClick={() => decide("denied")}>
              Rifiuta
            </Button>
            <Button onClick={() => decide("granted")}>Accetta</Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Conversion event after a signup request (a no-op unless the visitor accepted the tag). */
export function adsConversion() {
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION;
  const id = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (process.env.NEXT_PUBLIC_ADS_ENABLED !== "true" || !label || !id) return;
  try {
    if (localStorage.getItem(KEY) !== "granted") return;
    (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", "conversion", {
      send_to: `${id}/${label}`,
    });
  } catch {
    /* never break a signup for analytics */
  }
}
