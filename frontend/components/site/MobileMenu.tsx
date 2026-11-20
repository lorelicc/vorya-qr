"use client";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthCta } from "./AuthCta";
import { NavIcon } from "./NavIcon";
import type { NavGroup } from "./nav";
import styles from "./mobile.module.css";

const GROUP_ICON: Record<string, string> = {
  prodotto: "grid",
  tipi: "qr",
  soluzioni: "briefcase",
  risorse: "book",
};

/**
 * Phone menu: a sheet that slides in under the header. Level 1 lists the areas (big coloured
 * rows), level 2 the pages of one area; the two levels slide sideways. Accedi / Prova gratis stay
 * at the bottom, apart from each other. Scroll of the page is locked while it is open.
 */
export function MobileMenu({
  groups,
  open,
  anchor,
}: {
  groups: NavGroup[];
  open: boolean;
  /** The header element: the sheet starts right below it. */
  anchor: React.RefObject<HTMLElement | null>;
}) {
  const [view, setView] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const top = anchor.current?.getBoundingClientRect().bottom ?? 0;
    sheet.current?.style.setProperty("--sheet-top", `${Math.max(0, Math.round(top))}px`);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, anchor]);

  const group = groups.find((g) => g.key === view) ?? null;
  const items = group?.columns.flatMap((c) => c.items) ?? [];
  return (
    <div
      ref={sheet}
      className={styles.sheet}
      data-open={open || undefined}
      aria-hidden={!open}
      inert={!open}
    >
      <div className={styles.views} data-sub={group ? "" : undefined}>
        <nav className={styles.pane} aria-label="Menu">
          <Link href="/genera" className={styles.hero}>
            <span className={styles.heroIcon}>
              <NavIcon name="qr" size={22} />
            </span>
            <span>
              <b>Genera un QR gratis</b>
              <small>Senza registrazione</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
          {groups.map((g, i) => (
            <button
              key={g.key}
              type="button"
              className={styles.row}
              data-tone={g.tone}
              style={{ ["--i" as string]: i }}
              onClick={() => setView(g.key)}
            >
              <span className={styles.bubble}>
                <NavIcon name={GROUP_ICON[g.key] ?? "grid"} size={22} />
              </span>
              <span className={styles.rowText}>
                <b>{g.label}</b>
                <small>{g.intro.title}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ))}
          <Link
            href="/prezzi"
            className={styles.row}
            data-tone="mint"
            style={{ ["--i" as string]: groups.length }}
          >
            <span className={styles.bubble}>
              <NavIcon name="euro" size={22} />
            </span>
            <span className={styles.rowText}>
              <b>Prezzi</b>
              <small>Da gratis ad Agency</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </nav>

        <nav className={styles.pane} aria-label={group?.label ?? "Sezione"}>
          {group && (
            <div key={group.key} className={styles.sub} data-tone={group.tone}>
              <button type="button" className={styles.back} onClick={() => setView(null)}>
                <ArrowLeft size={18} aria-hidden="true" /> Menu
              </button>
              <h2>{group.label}</h2>
              <p>{group.intro.text}</p>
              <div className={styles.list}>
                {items.map((item, i) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.item}
                    style={{ ["--i" as string]: i }}
                  >
                    <span className={styles.bubble}>
                      <NavIcon name={item.icon} size={18} />
                    </span>
                    <span className={styles.rowText}>
                      <b>{item.label}</b>
                      {item.hint && <small>{item.hint}</small>}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>
      <div className={styles.cta}>
        <AuthCta sheet />
      </div>
    </div>
  );
}
