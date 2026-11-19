export const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Record<UtmKey, string>;

export const EMPTY_UTM: Utm = { source: "", medium: "", campaign: "", term: "", content: "" };

/** UTM parameters already in the URL (they would become duplicates). */
export function existingUtm(url: string): UtmKey[] {
  try {
    const params = new URL(url).searchParams;
    return UTM_KEYS.filter((k) => params.has(`utm_${k}`));
  } catch {
    return [];
  }
}

/** URL with the non-empty UTM fields appended; null when the URL is not valid. */
export function withUtm(url: string, utm: Utm): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  for (const key of UTM_KEYS) {
    const value = utm[key].trim();
    if (value) parsed.searchParams.set(`utm_${key}`, value);
  }
  return parsed.toString();
}

/** Fields that clash with parameters already present in the URL. */
export function utmConflicts(url: string, utm: Utm): UtmKey[] {
  const present = existingUtm(url);
  return UTM_KEYS.filter((k) => utm[k].trim() && present.includes(k));
}
