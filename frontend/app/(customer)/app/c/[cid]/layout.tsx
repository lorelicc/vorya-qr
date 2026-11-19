import { notFound } from "next/navigation";
import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { SearchDialog } from "@/components/organize/SearchDialog";
import { requireCustomer, serverGet } from "@/lib/auth-server";
import { CompanyProvider } from "@/lib/company-context";
import type { Company } from "@/lib/types";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cid: string }>;
}) {
  const me = await requireCustomer();
  const cid = Number((await params).cid);
  if (!Number.isSafeInteger(cid) || cid <= 0) notFound();
  const company = await serverGet<Company>(`companies/${cid}`);
  if (!company) notFound();
  const base = `/app/c/${cid}`;
  const nav: NavItem[] = [
    { href: base, label: "Link e QR", icon: "qr" },
    { href: `${base}/qr/new`, label: "Nuovo QR", icon: "new" },
    { href: `${base}/stats`, label: "Statistiche", icon: "stats" },
    { href: `${base}/styles`, label: "Stili", icon: "styles" },
    { href: `${base}/settings`, label: "Impostazioni", icon: "settings" },
    { href: "/account/plan", label: "Piano e utilizzo", icon: "plan" },
  ];
  return (
    <CompanyProvider company={company}>
      <AppShell
        me={me}
        nav={nav}
        context={me.workspace!.name}
        home="/companies"
        switcher={<CompanySwitcher current={company} />}
        headerExtra={<SearchDialog />}
      >
        {children}
      </AppShell>
    </CompanyProvider>
  );
}
