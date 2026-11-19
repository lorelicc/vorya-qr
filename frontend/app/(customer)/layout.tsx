import Link from "next/link";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { SidebarPromo } from "@/components/layout/SidebarPromo";
import { requireCustomer } from "@/lib/auth-server";
import { daysLeft } from "@/lib/format";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/app", label: "Codici QR", icon: "qr", exact: true },
  { href: "/app/qr/new", label: "Nuovo QR", icon: "new" },
  { href: "/account/plan", label: "Piano e utilizzo", icon: "plan" },
];

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const me = await requireCustomer();
  const workspace = me.workspace!;
  const trial = workspace.access === "trial";
  const promo = trial ? (
    <SidebarPromo
      title={`Prova Pro: ${daysLeft(workspace.trial_ends_at)} giorni`}
      footer={<Link href="/account/plan">Vedi utilizzo</Link>}
    >
      Al termine della prova i QR dinamici continuano a funzionare. Contattaci per attivare un
      piano.
    </SidebarPromo>
  ) : (
    <SidebarPromo title="QR dinamici" footer={<Link href="/app/qr/new">Crea un QR</Link>}>
      Cambia la destinazione quando vuoi, senza ristampare.
    </SidebarPromo>
  );
  return (
    <AppShell me={me} nav={NAV} context={workspace.name} promo={promo}>
      {children}
    </AppShell>
  );
}
