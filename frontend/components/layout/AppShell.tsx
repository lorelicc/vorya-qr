"use client";
import { Building2, Gauge, LayoutGrid, Layers, Menu, PlusCircle, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Me } from "@/lib/types";
import { Brand } from "./Brand";
import { LegalFooter } from "./LegalFooter";
import { UserMenu } from "./UserMenu";
import styles from "./AppShell.module.css";

const ICONS = {
  qr: LayoutGrid,
  new: PlusCircle,
  plan: Gauge,
  workspaces: Building2,
  plans: Layers,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

type Props = {
  me: Me;
  nav: NavItem[];
  context: string;
  promo?: ReactNode;
  children: ReactNode;
};

/** Vorya Apps layout (as in Vorya Sign): sidebar, global header bar, content. */
export function AppShell({ me, nav, context, promo, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const home = nav[0]?.href ?? "/";

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${open ? styles.open : ""}`}
        aria-label="Navigazione principale"
      >
        <div className={styles.sidebarBrand}>
          <Brand href={home} />
          <button
            type="button"
            className={styles.close}
            aria-label="Chiudi menu"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className={styles.nav}>
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.active : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {promo && <div className={styles.promo}>{promo}</div>}
        <div className={styles.sidebarBottom}>
          <span>Vorya QR</span>
          <span>v0.1.0</span>
        </div>
      </aside>
      {open && <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerStart}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Apri menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className={styles.mobileBrand}>
              <Brand compact href={home} />
            </span>
            <span className={styles.context}>{context}</span>
          </div>
          <UserMenu name={me.display_name} email={me.email} role={me.role} />
        </header>
        <main className={styles.content} id="main">
          {children}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
