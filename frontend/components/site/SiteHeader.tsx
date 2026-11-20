"use client";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/layout/Brand";
import { AuthCta } from "./AuthCta";
import type { NavGroup } from "./nav";
import styles from "./site.module.css";

/** Header with an animated mega-menu (hover or click) and an accordion menu on mobile. */
export function SiteHeader({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(null);
    setMobile(false);
  }, [pathname]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(null), setMobile(false));
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <header className={styles.header} ref={root} data-mobile={mobile || undefined}>
      <a href="#main" className={styles.skip}>
        Vai al contenuto
      </a>
      <div className={`${styles.container} ${styles.headerBar}`}>
        <Brand href="/" />
        <nav className={styles.nav} aria-label="Principale">
          {groups.map((group) => (
            <div
              key={group.key}
              className={styles.navItem}
              onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(group.key)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(null)}
            >
              <button
                type="button"
                aria-expanded={open === group.key}
                aria-controls={`menu-${group.key}`}
                onClick={() => setOpen(open === group.key ? null : group.key)}
              >
                {group.label} <ChevronDown size={14} aria-hidden="true" />
              </button>
              <div
                id={`menu-${group.key}`}
                className={styles.panel}
                data-open={open === group.key || undefined}
                data-wide={group.wide || undefined}
              >
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} tabIndex={open === group.key ? 0 : -1}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link href="/prezzi" className={styles.plain}>
            Prezzi
          </Link>
        </nav>
        <div className={styles.headerCta}>
          <AuthCta />
        </div>
        <button
          type="button"
          className={styles.burger}
          aria-label={mobile ? "Chiudi il menu" : "Apri il menu"}
          aria-expanded={mobile}
          onClick={() => setMobile((v) => !v)}
        >
          {mobile ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {mobile && (
        <div className={styles.mobilePanel}>
          {groups.map((group) => (
            <details key={group.key}>
              <summary>{group.label}</summary>
              <div>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
          <Link href="/prezzi" className={styles.mobilePlain}>
            Prezzi
          </Link>
          <div className={styles.mobileCta}>
            <AuthCta />
          </div>
        </div>
      )}
    </header>
  );
}
