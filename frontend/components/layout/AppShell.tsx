"use client";
import {
  BarChart3,
  Building2,
  Flag,
  Gauge,
  LayoutGrid,
  Layers,
  Menu as MenuIcon,
  Palette,
  PlusCircle,
  Repeat,
  Settings,
  ShieldBan,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Me } from "@/lib/types";
import { PastDueNotice } from "@/components/billing/BillingBanner";
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
  stats: BarChart3,
  styles: Palette,
  settings: Settings,
  companies: Building2,
  abuse: Flag,
  blocked: ShieldBan,
  transfers: Repeat,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

type Props = {
  me: Me;
  nav: NavItem[];
  context: string;
  home?: string;
  switcher?: ReactNode;
  promo?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
};

/** The nav item whose href is the longest prefix of the current path. */
export function activeHref(pathname: string, nav: NavItem[]): string | undefined {
  return nav
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Vorya Apps layout (as in Vorya Sign): sidebar, global header bar, content. */
export function AppShell({
  me,
  nav,
  context,
  home,
  switcher,
  promo,
  headerExtra,
  children,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = activeHref(pathname, nav);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ y: number; h: number } | null>(null);

  // The active marker slides between items (transform only).
  useLayoutEffect(() => {
    const node = navRef.current?.querySelector<HTMLElement>("[aria-current=page]");
    setIndicator(node ? { y: node.offsetTop, h: node.offsetHeight } : null);
  }, [active]);

  return (
    <div className={styles.shell}>
      <aside
        className={styles.sidebar}
        data-open={open || undefined}
        aria-label="Navigazione principale"
      >
        <div className={styles.sidebarBrand}>
          <Brand href={home ?? nav[0]?.href ?? "/"} />
          <button
            type="button"
            className={styles.close}
            aria-label="Chiudi menu"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        {switcher && <div className={styles.switcher}>{switcher}</div>}
        <nav className={styles.nav} ref={navRef}>
          {indicator && (
            <span
              className={styles.indicator}
              style={{ transform: `translateY(${indicator.y}px)`, height: indicator.h }}
              aria-hidden="true"
            />
          )}
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={styles.navItem}
                data-active={isActive || undefined}
                aria-current={isActive ? "page" : undefined}
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
          <span>v0.3.0</span>
        </div>
      </aside>
      <div
        className={styles.scrim}
        data-open={open || undefined}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerStart}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Apri menu"
              onClick={() => setOpen(true)}
            >
              <MenuIcon size={22} />
            </button>
            <span className={styles.mobileBrand}>
              <Brand compact href={home ?? "/"} />
            </span>
            <span className={styles.context}>{context}</span>
          </div>
          <div className={styles.headerEnd}>
            {headerExtra}
            <UserMenu name={me.display_name} email={me.email} role={me.role} />
          </div>
        </header>
        <main className={styles.content} id="main">
          {me.workspace?.access === "past_due" && pathname !== "/account/plan" && <PastDueNotice />}
          {children}
        </main>
        <LegalFooter />
      </div>
    </div>
  );
}
