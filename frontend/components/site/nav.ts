import { FEATURES, SOLUTIONS, TYPES, featurePath, verifiedAlternatives } from "@/lib/site/content";

export type NavLink = { label: string; href: string; hint?: string };
export type Tone = "mint" | "lilac" | "sun" | "coral";
export type NavItem = NavLink & { icon: string };
export type NavColumn = { title?: string; items: NavItem[] };
export type NavGroup = {
  key: string;
  label: string;
  tone: Tone;
  /** Left panel of the mega menu: what this area is about, with one call to action. */
  intro: { title: string; text: string; cta: NavLink };
  columns: NavColumn[];
  /** Flat list (footer and phone menu). */
  links: NavLink[];
  wide?: boolean;
};

const FEATURE_ICON: Record<string, string> = {
  "link-brevi": "link",
  "qr-dinamici": "refresh",
  "pagine-ospitate": "layout",
  "design-qr": "palette",
  statistiche: "chart",
  "multi-azienda": "building",
  "import-massivo": "sheet",
  "menu-carta-dei-vini": "menu",
};
const SOLUTION_ICON: Record<string, string> = {
  ristoranti: "menu",
  cantine: "wine",
  eventi: "party",
  agenzie: "briefcase",
  negozi: "bag",
  immobiliare: "home",
};
const TYPE_GROUPS: { title: string; slugs: string[] }[] = [
  {
    title: "Contatti e social",
    slugs: ["vcard", "link-in-bio", "whatsapp", "telefono", "sms", "email"],
  },
  { title: "Contenuti", slugs: ["sito-web", "pdf", "musica", "galleria", "testo"] },
  { title: "Per il tuo locale", slugs: ["attivita", "menu", "carta-dei-vini", "wifi"] },
];

const typeItem = (slug: string): NavItem => {
  const t = TYPES.find((x) => x.slug === slug)!;
  return { label: t.label, href: `/qr-code/${t.slug}`, icon: t.slug };
};

const flat = (columns: NavColumn[]): NavLink[] =>
  columns.flatMap((c) => c.items.map(({ label, href, hint }) => ({ label, href, hint })));

/** Single source for the header mega-menu, the phone menu and the footer. */
export function navGroups(): NavGroup[] {
  const product: NavColumn[] = [
    {
      items: [
        {
          label: "Tutte le funzionalità",
          href: "/funzionalita",
          icon: "grid",
          hint: "Tutto ciò che include Vorya QR",
        },
        ...FEATURES.map((f) => ({
          label: f.label,
          href: featurePath(f),
          icon: FEATURE_ICON[f.slug] ?? "grid",
          hint: f.text,
        })),
      ],
    },
  ];
  const types: NavColumn[] = TYPE_GROUPS.map((g) => ({
    title: g.title,
    items: [
      ...(g.title === "Contenuti"
        ? [
            {
              label: "Link breve",
              href: "/link-brevi",
              icon: "link",
              hint: "Accorcia e misura i click",
            },
          ]
        : []),
      ...g.slugs.map(typeItem),
    ],
  }));
  const solutions: NavColumn[] = [
    {
      items: SOLUTIONS.map((s) => ({
        label: s.label,
        href: `/soluzioni/${s.slug}`,
        icon: SOLUTION_ICON[s.slug] ?? "grid",
        hint: s.problem,
      })),
    },
  ];
  const resources: NavColumn[] = [
    {
      items: [
        { label: "Guide", href: "/guide", icon: "book", hint: "Come usare QR e link al meglio" },
        {
          label: "Domande frequenti",
          href: "/faq",
          icon: "help",
          hint: "Piani, QR, privacy, fatture",
        },
        ...verifiedAlternatives().map((a) => ({
          label: `Alternativa a ${a.name}`,
          href: `/alternative/${a.slug}`,
          icon: "scale",
        })),
        { label: "Genera un QR gratis", href: "/genera", icon: "qr", hint: "Senza registrazione" },
        { label: "Chi siamo", href: "/chi-siamo", icon: "users" },
        { label: "Contatti", href: "/contatti", icon: "mail" },
      ],
    },
  ];
  return [
    {
      key: "prodotto",
      label: "Prodotto",
      tone: "mint",
      intro: {
        title: "Tutto per link e QR, in un solo posto",
        text: "Crea, personalizza, aggiorna e misura senza strumenti separati.",
        cta: { label: "Prova gratis", href: "/register" },
      },
      columns: product,
      links: flat(product),
    },
    {
      key: "tipi",
      label: "Tipi di QR",
      tone: "lilac",
      wide: true,
      intro: {
        title: "15 tipi di QR",
        text: "Statici gratis per sempre, dinamici quando vuoi cambiare dopo la stampa.",
        cta: { label: "Genera un QR gratis", href: "/genera" },
      },
      columns: types,
      links: flat(types),
    },
    {
      key: "soluzioni",
      label: "Soluzioni",
      tone: "sun",
      intro: {
        title: "Per chi stampa e condivide",
        text: "Dal ristorante all’agenzia: come lo usano le attività come la tua.",
        cta: { label: "Vedi tutte le soluzioni", href: "/soluzioni" },
      },
      columns: solutions,
      links: flat(solutions),
    },
    {
      key: "risorse",
      label: "Risorse",
      tone: "coral",
      intro: {
        title: "Impara e risolvi i dubbi",
        text: "Guide pratiche, risposte rapide e un team che parla italiano.",
        cta: { label: "Scrivici", href: "/contatti" },
      },
      columns: resources,
      links: flat(resources),
    },
  ];
}
