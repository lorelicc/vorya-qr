"use client";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import apps from "@/content/site/vorya-apps.json";
import styles from "./header.module.css";

/** Arrow next to the logo: the other apps of the Vorya family (content/site/vorya-apps.json). */
export function VoryaFamily() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  return (
    <div className={styles.family} ref={root}>
      <button
        type="button"
        className={styles.familyButton}
        aria-expanded={open}
        aria-controls="vorya-family"
        aria-label="Le app della famiglia Vorya"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div id="vorya-family" className={styles.familyPanel} data-open={open || undefined}>
        <p>La famiglia Vorya</p>
        {apps.apps.map((app) => (
          <a
            key={app.key}
            href={app.href}
            data-tone={app.tone}
            aria-current={app.current ? "true" : undefined}
            tabIndex={open ? 0 : -1}
            {...(app.current ? {} : { rel: "noopener" })}
          >
            <b>{app.name}</b>
            <span>{app.text}</span>
            {!app.current && <ExternalLink size={14} aria-hidden="true" />}
          </a>
        ))}
        <a
          href={apps.all.href}
          className={styles.familyAll}
          tabIndex={open ? 0 : -1}
          rel="noopener"
        >
          {apps.all.label} →
        </a>
      </div>
    </div>
  );
}
