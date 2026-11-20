/** The commercial offer of the public site (featured plan, yearly discount, promo strip, trial). */
export type SiteOffer = {
  featured_plan: string | null;
  featured_label: string;
  yearly_discount_pct: number;
  yearly_label: string;
  trial: { days: number; plan_id: string; plan_name: string };
  banner: {
    enabled: boolean;
    text: string;
    cta: string;
    href: string;
    tone: "green" | "indigo" | "sun" | "coral";
  };
};

/**
 * Read from the admin-managed settings (`cached`: the layout of every page refreshes it once a
 * minute instead of rendering all pages on demand); `null` (no strip, no highlight) if the API is down. */
export async function fetchOffer(cached = false): Promise<SiteOffer | null> {
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${base}/api/public/site/offer`, {
      ...(cached ? { next: { revalidate: 60 } } : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(3000),
    });
    return response.ok ? ((await response.json()) as SiteOffer) : null;
  } catch {
    return null;
  }
}
