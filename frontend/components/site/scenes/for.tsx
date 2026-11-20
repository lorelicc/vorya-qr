import type { ReactNode } from "react";
import { CompaniesScene, ImportScene, PagesScene } from "./extra";
import { PhoneScene } from "./phone";
import { DesignScene, HeroScene, LinkScene, StatsScene } from "./product";
import { SECTOR_SPECS, TYPE_SPECS } from "./specs";
import { MenuScene } from "./story";

/** Which animated scene illustrates each landing (all others fall back to the static art). */
const FEATURE: Record<string, () => ReactNode> = {
  "link-brevi": () => <LinkScene />,
  "qr-dinamici": () => <HeroScene />,
  "pagine-ospitate": () => <PagesScene />,
  "design-qr": () => <DesignScene />,
  statistiche: () => <StatsScene />,
  "multi-azienda": () => <CompaniesScene />,
  "import-massivo": () => <ImportScene />,
  "menu-carta-dei-vini": () => <MenuScene />,
};

export const featureScene = (slug: string) => FEATURE[slug]?.();

/** Every sector has its own: restaurants and wineries the menu, agencies the statistics. */
export function solutionScene(slug: string): ReactNode {
  if (slug === "ristoranti" || slug === "cantine") return <MenuScene />;
  if (slug === "agenzie") return <StatsScene />;
  const spec = SECTOR_SPECS[slug];
  return spec ? (
    <PhoneScene spec={spec} label={`cosa vede chi scansiona il QR (${slug})`} tone="sun" />
  ) : undefined;
}

/** All 15 QR types: the phone shows what that type opens. */
export function typeScene(slug: string): ReactNode {
  const spec = TYPE_SPECS[slug];
  if (!spec) return <DesignScene />;
  return <PhoneScene spec={spec} label={`cosa apre il QR di tipo ${slug}`} tone="mint" />;
}
