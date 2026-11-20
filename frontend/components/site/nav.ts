import { FEATURES, SOLUTIONS, TYPES, featurePath, verifiedAlternatives } from "@/lib/site/content";

export type NavLink = { label: string; href: string; hint?: string };
export type NavGroup = { key: string; label: string; links: NavLink[]; wide?: boolean };

/** Single source for the header mega-menu and the footer, built from the content files. */
export function navGroups(): NavGroup[] {
  return [
    {
      key: "prodotto",
      label: "Prodotto",
      links: [
        {
          label: "Tutte le funzionalità",
          href: "/funzionalita",
          hint: "Tutto ciò che include Vorya QR",
        },
        ...FEATURES.map((f) => ({ label: f.label, href: featurePath(f), hint: f.text })),
      ],
    },
    {
      key: "tipi",
      label: "Tipi di QR",
      wide: true,
      links: [
        { label: "Link breve", href: "/link-brevi" },
        ...TYPES.map((t) => ({ label: t.label, href: `/qr-code/${t.slug}` })),
      ],
    },
    {
      key: "soluzioni",
      label: "Soluzioni",
      links: SOLUTIONS.map((s) => ({
        label: s.label,
        href: `/soluzioni/${s.slug}`,
        hint: s.problem,
      })),
    },
    {
      key: "risorse",
      label: "Risorse",
      links: [
        { label: "Guide", href: "/guide" },
        ...verifiedAlternatives().map((a) => ({
          label: `Alternativa a ${a.name}`,
          href: `/alternative/${a.slug}`,
        })),
        { label: "Genera un QR gratis", href: "/genera" },
        { label: "Chi siamo", href: "/chi-siamo" },
        { label: "Contatti", href: "/contatti" },
      ],
    },
  ];
}
