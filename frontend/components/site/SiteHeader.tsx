"use client";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AuthCta } from "./AuthCta";
import { LogoSwap } from "./LogoSwap";
import { MegaArt } from "./MegaArt";
import { MobileMenu } from "./MobileMenu";
import { NavIcon } from "./NavIcon";
import { VoryaFamily } from "./VoryaFamily";
import type { NavGroup } from "./nav";
import styles from "./header.module.css";

/** Header with a coloured mega-menu (hover or click) and an accordion menu on phones. */
export function SiteHeader({ groups }: { groups: NavGroup[] }) {
  // Keyed by path: every navigation remounts it, so the menus are closed again.
  return <HeaderInner key={usePathname()} groups={groups} />;
}

const SCROLLED_AT = 24;
const onScroll = (notify: () => void) => {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
};

function HeaderInner({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const scrolled = useSyncExternalStore(
    onScroll,
    () => window.scrollY > SCROLLED_AT,
    () => false,
  );
  // The home opens on a dark hero: the header is dark there and turns white as the page scrolls.
  const dark = path === "/" && !scrolled;
  const [open, setOpenState] = useState<string | null>(null);
  // True while jumping straight from one menu to another: no entrance animation is replayed.
  const [switching, setSwitching] = useState(false);
  const openRef = useRef<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opening = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setOpen = useCallback((key: string | null) => {
    setSwitching(key !== null && openRef.current !== null && openRef.current !== key);
    openRef.current = key;
    setOpenState(key);
  }, []);
  const clearTimers = useCallback(() => {
    if (closing.current) clearTimeout(closing.current);
    if (opening.current) clearTimeout(opening.current);
  }, []);

  // Hover intent: brushing over the items must not make menus flash. The first menu opens after
  // 120 ms; once one is open, moving to another is instant; leaving closes after 350 ms, so
  // crossing the small gap between the header and the menu does not close it.
  const hold = (key: string) => {
    clearTimers();
    if (openRef.current !== null) setOpen(key);
    else opening.current = setTimeout(() => setOpen(key), 120);
  };
  const release = () => {
    clearTimers();
    closing.current = setTimeout(() => setOpen(null), 350);
  };

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
      clearTimers();
    };
  }, [setOpen, clearTimers]);

  return (
    <header
      className={styles.header}
      ref={root}
      data-mobile={mobile || undefined}
      data-theme={dark ? "dark" : undefined}
      data-scrolled={scrolled || undefined}
      data-switching={switching || undefined}
    >
      <a href="#main" className={styles.skip}>
        Vai al contenuto
      </a>
      <div className={`${styles.container} ${styles.bar}`}>
        <div className={styles.brandRow}>
          <LogoSwap dark={dark} />
          <VoryaFamily />
        </div>
        <nav className={styles.nav} aria-label="Principale">
          {groups.map((group) => (
            <div
              key={group.key}
              className={styles.item}
              onPointerEnter={(e) => e.pointerType === "mouse" && hold(group.key)}
              onPointerLeave={(e) => e.pointerType === "mouse" && release()}
            >
              <button
                type="button"
                aria-expanded={open === group.key}
                aria-controls={`menu-${group.key}`}
                onClick={() => {
                  clearTimers();
                  setOpen(open === group.key ? null : group.key);
                }}
              >
                {group.label} <ChevronDown size={14} aria-hidden="true" />
              </button>
              <div
                id={`menu-${group.key}`}
                className={styles.mega}
                data-open={open === group.key || undefined}
                data-tone={group.tone}
              >
                <div className={styles.megaCard}>
                  <div className={styles.megaInner}>
                    <div className={styles.intro}>
                      <strong>{group.intro.title}</strong>
                      <p>{group.intro.text}</p>
                      <MegaArt kind={group.key === "tipi" ? "tipi" : group.key} />
                      <Link href={group.intro.cta.href} tabIndex={open === group.key ? 0 : -1}>
                        {group.intro.cta.label} →
                      </Link>
                    </div>
                    <div className={styles.columns} data-cols={group.columns.length}>
                      {group.columns.map((column, i) => (
                        <div
                          key={column.title ?? i}
                          className={styles.column}
                          data-grid={group.columns.length === 1 || undefined}
                        >
                          {column.title && <h2>{column.title}</h2>}
                          {column.items.map((item, n) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={styles.tile}
                              style={{ ["--i" as string]: n }}
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
          <span className={styles.bars} data-open={mobile || undefined} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      </div>
      <MobileMenu groups={groups} open={mobile} anchor={root} />
    </header>
  );
}
