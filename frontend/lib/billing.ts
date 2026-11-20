import type { UsageItem as Usage } from "@/lib/types";

export type Cycle = "monthly" | "yearly";
export type BillingState =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "gift"
  | "free";

export type PlanPrices = Partial<Record<Cycle, { amount_cents: number; currency: string }>>;

export type PlanCardData = {
  id: string;
  name: string;
  description: string;
  limits: { static_qr: number | null; dynamic_qr: number | null; companies: number | null };
  features: {
    custom_back_half: boolean;
    max_aliases_per_link: number | null;
    link_rules: boolean;
    utm_templates: boolean;
    max_bulk_rows: number;
    version_history: boolean;
    menu_type: boolean;
    allowed_types: string[];
  };
  prices: PlanPrices;
};

export type PublicPlans = {
  plans: PlanCardData[];
  type_labels: Record<string, string>;
  online_payments: boolean;
};

export type BillingProfile = {
  legal_name: string;
  vat: string;
  tax_code: string;
  address: string;
  zip: string;
  city: string;
  province: string;
  country: string;
  sdi_code: string;
  pec: string;
};

export type Payment = {
  id: string;
  amount_cents: number;
  currency: string;
  status: "paid" | "failed";
  paid_at: string | null;
  document_url: string | null;
};

export type BillingInfo = {
  state: BillingState;
  access: string;
  plan: PlanCardData;
  plans: PlanCardData[];
  type_labels: Record<string, string>;
  cycle: Cycle | null;
  period_end: string | null;
  cancel_at_period_end: boolean;
  has_subscription: boolean;
  trial_ends_at: string | null;
  grace_until: string | null;
  grant_until: string | null;
  grace_days: number;
  usage: Record<"dynamic" | "static" | "companies" | "storage", Usage>;
  profile: BillingProfile | null;
  online_payments: boolean;
  payments: Payment[];
};

export const STATE_LABEL: Record<BillingState, string> = {
  trialing: "In prova",
  active: "Attivo",
  past_due: "Pagamento in ritardo",
  canceled: "Annullato",
  unpaid: "Non attivo",
  gift: "Omaggio",
  free: "Free",
};

export const CYCLE_LABEL: Record<Cycle, string> = { monthly: "mese", yearly: "anno" };

export function formatMoney(cents: number, currency = "eur"): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Saving of the yearly price versus twelve months, as a whole percentage (0 when none). */
export function yearlySaving(prices: PlanPrices): number {
  const m = prices.monthly?.amount_cents;
  const y = prices.yearly?.amount_cents;
  if (!m || !y || y >= m * 12) return 0;
  return Math.round((1 - y / (m * 12)) * 100);
}

const limit = (n: number | null, one: string, many: string) =>
  n === null ? `${many} illimitati` : `${n} ${n === 1 ? one : many}`;

/** The feature lines of a plan card: everything comes from the plan's limits/features. */
export function featureLines(plan: PlanCardData, labels: Record<string, string>): string[] {
  const f = plan.features;
  const lines = [
    limit(plan.limits.dynamic_qr, "QR dinamico", "QR dinamici"),
    limit(plan.limits.static_qr, "QR statico", "QR statici"),
    limit(plan.limits.companies, "azienda", "aziende"),
  ];
  if (f.custom_back_half)
    lines.push(
      f.max_aliases_per_link === null
        ? "Back-half personalizzati"
        : `Fino a ${f.max_aliases_per_link} back-half per link`,
    );
  if (f.link_rules) lines.push("Scadenza, password e programmazione dei link");
  if (f.utm_templates) lines.push("Template UTM aziendali");
  if (f.max_bulk_rows > 0) lines.push(`Creazione da CSV fino a ${f.max_bulk_rows} righe`);
  if (f.version_history) lines.push("Cronologia versioni e ripristino");
  if (f.menu_type) lines.push("Menu e carta dei vini");
  const types = f.allowed_types.map((t) => labels[t]).filter(Boolean);
  if (types.length) lines.push(`Tipi di pagina: ${types.join(", ")}`);
  return lines;
}
