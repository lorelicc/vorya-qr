import {
  Bean, Egg, Fish, Flower2, Leaf, Milk, Nut, Shell, Shrimp, Sprout, Wheat, Wine,
  Droplets, Squirrel, type LucideIcon,
} from "lucide-react"; // prettier-ignore
import type { Allergen, Badge, Lang } from "@/lib/page-types";

/** The 14 allergens of Reg. (EU) 1169/2011, annex II. Icon + label: never colour alone. */
export const ALLERGEN_META: Record<Allergen, { icon: LucideIcon; it: string; en: string }> = {
  gluten: { icon: Wheat, it: "Glutine", en: "Gluten" },
  crustaceans: { icon: Shrimp, it: "Crostacei", en: "Crustaceans" },
  eggs: { icon: Egg, it: "Uova", en: "Eggs" },
  fish: { icon: Fish, it: "Pesce", en: "Fish" },
  peanuts: { icon: Squirrel, it: "Arachidi", en: "Peanuts" },
  soy: { icon: Bean, it: "Soia", en: "Soy" },
  milk: { icon: Milk, it: "Latte", en: "Milk" },
  nuts: { icon: Nut, it: "Frutta a guscio", en: "Tree nuts" },
  celery: { icon: Leaf, it: "Sedano", en: "Celery" },
  mustard: { icon: Droplets, it: "Senape", en: "Mustard" },
  sesame: { icon: Sprout, it: "Sesamo", en: "Sesame" },
  sulphites: { icon: Wine, it: "Solfiti", en: "Sulphites" },
  lupin: { icon: Flower2, it: "Lupini", en: "Lupin" },
  molluscs: { icon: Shell, it: "Molluschi", en: "Molluscs" },
};

export const BADGE_META: Record<Badge, { it: string; en: string }> = {
  vegan: { it: "Vegano", en: "Vegan" },
  vegetarian: { it: "Vegetariano", en: "Vegetarian" },
  organic: { it: "Bio", en: "Organic" },
  gluten_free: { it: "Senza glutine", en: "Gluten free" },
  new: { it: "Novità", en: "New" },
  recommended: { it: "Consigliato", en: "Recommended" },
};

export const UI = {
  it: {
    search: "Cerca nel menu",
    sections: "Sezioni",
    filters: "Filtri",
    without: "Senza allergeni",
    only: "Solo",
    soldOut: "Esaurito",
    glass: "Calice",
    bottle: "Bottiglia",
    legend: "Allergeni",
    none: "Nessuna voce corrisponde ai filtri.",
    reset: "Azzera i filtri",
    vintage: "Annata",
  },
  en: {
    search: "Search the menu",
    sections: "Sections",
    filters: "Filters",
    without: "Allergen-free of",
    only: "Only",
    soldOut: "Sold out",
    glass: "Glass",
    bottle: "Bottle",
    legend: "Allergens",
    none: "No item matches the filters.",
    reset: "Clear filters",
    vintage: "Vintage",
  },
} satisfies Record<Lang, Record<string, string>>;

export const allergenLabel = (a: Allergen, lang: Lang) => ALLERGEN_META[a][lang];
export const badgeLabel = (b: Badge, lang: Lang) => BADGE_META[b][lang];

export function formatPrice(value: string | null | undefined, currency: string, lang: Lang) {
  if (!value) return "";
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "it-IT", {
    style: "currency",
    currency,
  }).format(Number(value));
}
