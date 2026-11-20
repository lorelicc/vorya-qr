import type { PublicPlans } from "@/lib/billing";

/**
 * Plans for the public pages: the admin-managed tables are the ONLY source of truth (no prices or
 * limits in the code). Never cached (a price changed in the admin shows at once; the call is cheap); `null` when the API is not reachable (the page then
 * says so instead of showing made-up numbers).
 */
export async function fetchPlans(): Promise<PublicPlans | null> {
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(`${base}/api/public/plans`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as PublicPlans) : null;
  } catch {
    return null;
  }
}
