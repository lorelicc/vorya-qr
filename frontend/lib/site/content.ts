import alternativesJson from "@/content/site/alternatives.json";
import faqJson from "@/content/site/faq.json";
import featuresJson from "@/content/site/features.json";
import homeJson from "@/content/site/home.json";
import messagesJson from "@/content/site/messages.json";
import socialJson from "@/content/site/social-proof.json";
import solutionsJson from "@/content/site/solutions.json";
import typesJson from "@/content/site/types.json";

/** All site copy lives in /content (JSON and MDX): editing text never touches components. */
export type FaqItem = { q: string; a: string };
export type QrTypeContent = (typeof typesJson)[number];
export type SolutionContent = (typeof solutionsJson)[number];
export type FeatureContent = (typeof featuresJson)[number];
export type AlternativeContent = (typeof alternativesJson)[number];

export const TYPES = typesJson;
export const SOLUTIONS = solutionsJson;
export const FEATURES = featuresJson;
export const ALTERNATIVES = alternativesJson;
export const MESSAGES = messagesJson;
export const HOME = homeJson;
export const FAQ = faqJson as Record<"home" | "pricing" | "qr" | "privacy", FaqItem[]>;
export const SOCIAL = socialJson as {
  testimonials: { quote: string; author: string; role?: string }[];
  logos: { name: string; src: string }[];
};

export const typeBySlug = (slug: string) => TYPES.find((t) => t.slug === slug);
export const solutionBySlug = (slug: string) => SOLUTIONS.find((s) => s.slug === slug);
export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug && f.page);
export const alternativeBySlug = (slug: string) => ALTERNATIVES.find((a) => a.slug === slug);
export const featurePath = (f: FeatureContent) =>
  f.page ? `/funzionalita/${f.slug}` : `/funzionalita#${f.slug}`;
/** Comparisons are published (indexed, listed) only after an admin verified every claim. */
export const verifiedAlternatives = () => ALTERNATIVES.filter((a) => a.verified);
