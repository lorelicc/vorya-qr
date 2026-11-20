"use client";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/layout/Brand";
import { AuthCta } from "./AuthCta";
import { NavIcon } from "./NavIcon";
import { VoryaFamily } from "./VoryaFamily";
import type { NavGroup } from "./nav";
import styles from "./header.module.css";

/** Header with a coloured mega-menu (hover or click) and an accordion menu on phones. */
export function SiteHeader({ groups }: { groups: NavGroup[] }) {
  // Keyed by path: every navigation remounts it, so the menus are closed again.
  return <HeaderInner key={usePathname()} groups={groups} />;
}

function HeaderInner({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);

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
      <div className={`${styles.container} ${styles.bar}`}>
        <div className={styles.brandRow}>
          <Brand href="/" />
          <VoryaFamily />
        </div>
        <nav className={styles.nav} aria-label="Principale">
          {groups.map((group) => (
            <div
              key={group.key}
              className={styles.item}
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
                className={styles.mega}
                data-open={open === group.key || undefined}
                data-tone={group.tone}
              >
                <div className={`${styles.container} ${styles.megaInner}`}>
                  <div className={styles.intro}>
                    <strong>{group.intro.title}</strong>
                    <p>{group.intro.text}</p>
                    <Link href={group.intro.cta.href} tabIndex={open === group.key ? 0 : -1}>
                      {group.intro.cta.label} →
                    </Link>
                  </div>
                  <div className={styles.columns} data-cols={group.columns.length}>
                    {group.columns.map((column, i) => (
                      <div key={column.title ?? i} className={styles.column}>
                        {column.title && <h2>{column.title}</h2>}
                        {column.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={styles.tile}
                            tabIndex={open === group.key ? 0 : -1}
                          >
                            <span className={styles.bubble}>
                              <NavIcon name={item.icon} />
                            </span>
                            <span className={styles.tileText}>
                              <b>{item.label}</b>
                              {item.hint && <small>{item.hint}</small>}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Link href="/prezzi" className={styles.plain}>
            Prezzi
          </Link>
        </nav>
        <div className={styles.cta}>
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
            <details key={group.key} data-tone={group.tone}>
              <summary>{group.label}</summary>
              <div>
                {group.columns
                  .flatMap((c) => c.items)
                  .map((item) => (
                    <Link key={item.href} href={item.href}>
                      <span className={styles.bubble}>
                        <NavIcon name={item.icon} size={16} />
                      </span>
                      {item.label}
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
