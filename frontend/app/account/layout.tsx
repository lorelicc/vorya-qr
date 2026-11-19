import Link from "next/link";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { requireBillingCustomer } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/companies", label: "Aziende", icon: "companies" },
  { href: "/account/plan", label: "Piano e utilizzo", icon: "plan" },
];

/** Reachable also by blocked workspaces: this is where they pay. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const me = await requireBillingCustomer();
  return (
    <AppShell me={me} nav={NAV} context={me.workspace!.name} home="/companies">
      {children}
      <p className="muted">
        <Link href="/plans">Confronta i piani</Link>
      </p>
    </AppShell>
  );
}
