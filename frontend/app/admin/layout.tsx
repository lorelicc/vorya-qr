import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/admin/clients", label: "Clienti", icon: "workspaces" },
  { href: "/admin/plans", label: "Piani", icon: "plans" },
  { href: "/admin/billing", label: "Pagamenti", icon: "plans" },
  { href: "/admin/reports", label: "Segnalazioni", icon: "abuse" },
  { href: "/admin/blocked-domains", label: "Domini bloccati", icon: "blocked" },
  { href: "/admin/transfers", label: "Trasferimenti", icon: "transfers" },
  { href: "/admin/reserved-words", label: "Parole riservate", icon: "blocked" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <AppShell me={me} nav={NAV} context="Amministrazione Vorya QR">
      {children}
    </AppShell>
  );
}
