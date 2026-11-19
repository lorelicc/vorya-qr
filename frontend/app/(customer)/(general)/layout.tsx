import Link from "next/link";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { SidebarPromo } from "@/components/layout/SidebarPromo";
import { requireCustomer } from "@/lib/auth-server";
import { daysLeft } from "@/lib/format";

const NAV: NavItem[] = [
  { href: "/companies", label: "Aziende", icon: "companies" },
  { href: "/account/plan", label: "Piano e utilizzo", icon: "plan" },
];

export default async function GeneralLayout({ children }: { children: React.ReactNode }) {
  const me = await requireCustomer();
  const workspace = me.workspace!;
  const promo =
    workspace.access === "trial" ? (
      <SidebarPromo
        title={`Prova Pro: ${daysLeft(workspace.trial_ends_at)} giorni`}
        footer={<Link href="/account/plan">Vedi utilizzo</Link>}
      >
        Al termine della prova i QR dinamici continuano a funzionare. Contattaci per attivare un
        piano.
      </SidebarPromo>
    ) : undefined;
  return (
    <AppShell me={me} nav={NAV} context={workspace.name} home="/companies" promo={promo}>
      {children}
    </AppShell>
  );
}
