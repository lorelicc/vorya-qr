import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { requireAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/admin/workspaces", label: "Spazi di lavoro", icon: "workspaces" },
  { href: "/admin/plans", label: "Piani", icon: "plans" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <AppShell me={me} nav={NAV} context="Amministrazione Vorya QR">
      {children}
    </AppShell>
  );
}
