import type { ReactNode } from "react";
import { DesignScene, HeroScene, LinkScene, StatsScene } from "./product";
import { MenuScene, ReportScene } from "./story";

/** Which animated scene illustrates each landing (all others fall back to the static art). */
const FEATURE: Record<string, () => ReactNode> = {
  "link-brevi": () => <LinkScene />,
  "qr-dinamici": () => <HeroScene />,
  "pagine-ospitate": () => <MenuScene />,
  "design-qr": () => <DesignScene />,
  statistiche: () => <StatsScene />,
  "import-massivo": () => <LinkScene />,
  "menu-carta-dei-vini": () => <MenuScene />,
};
const SOLUTION: Record<string, () => ReactNode> = {
  ristoranti: () => <MenuScene />,
  cantine: () => <MenuScene />,
  eventi: () => <HeroScene />,
  agenzie: () => <StatsScene />,
  negozi: () => <HeroScene />,
  immobiliare: () => <ReportScene />,
};

export const featureScene = (slug: string) => FEATURE[slug]?.();
export const solutionScene = (slug: string) => SOLUTION[slug]?.();
export const typeScene = (slug: string) =>
  slug === "menu" || slug === "carta-dei-vini" ? <MenuScene /> : <DesignScene />;
