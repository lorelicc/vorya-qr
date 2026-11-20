"use client";
import { useState } from "react";
import { PublicGenerator } from "./PublicGenerator";
import { ShortLinkTab } from "./ShortLinkTab";
import styles from "./generator.module.css";

/** Home hero: the tools sit right in the first screen, as tabs ("Link breve" / "QR code"). */
export function HeroGenerator() {
  const [tab, setTab] = useState<"qr" | "link">("qr");
  return (
    <div className={styles.hero}>
      <div className={styles.tabs} role="tablist" aria-label="Strumento">
        <button type="button" role="tab" aria-selected={tab === "qr"} onClick={() => setTab("qr")}>
          QR code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "link"}
          onClick={() => setTab("link")}
        >
          Link breve
        </button>
      </div>
      {tab === "qr" ? <PublicGenerator landing="/" /> : <ShortLinkTab />}
    </div>
  );
}
