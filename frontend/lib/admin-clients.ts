import type { BadgeTone } from "@/components/ui";
import type { Access, UsageItem } from "@/lib/types";

export type ClientState =
  | "none"
  | "trialing"
  | "expired"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "gift";

export type ClientRow = {
  id: number;
  name: string;
  owner: { display_name: string; email: string };
  plan_id: string;
  status: string;
  access: Access;
  billing_state: ClientState;
  grant_until: string | null;
  trial_ends_at: string | null;
  billing_complete: boolean;
  legal_name: string | null;
  vat: string | null;
  tax_code: string | null;
  companies: number;
  codes: number;
  created_at: string;
};

export type Grant = {
  id: number;
  plan_id: string;
  months: number;
  starts_at: string;
  ends_at: string;
  note: string;
  revoked_at: string | null;
  created_at: string;
};

export type ClientDetailData = {
  id: number;
  name: string;
  owner: { id: number; display_name: string; email: string; last_login_at: string | null };
  plan_id: string;
  status: string;
  access: Access;
  billing_state: ClientState;
  trial_ends_at: string | null;
  grant_until: string | null;
  created_at: string;
  usage: Record<string, UsageItem>;
  profile: {
    legal_name: string; vat: string; tax_code: string; address: string; zip: string;
    city: string; province: string; country: string; sdi_code: string; pec: string;
  } | null; // prettier-ignore
  subscription: {
    customer_id: string | null;
    subscription_id: string | null;
    cycle: string | null;
    period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  payments: {
    id: string;
    amount_cents: number;
    currency: string;
    status: "paid" | "failed";
    paid_at: string | null;
  }[];
  grants: Grant[];
  companies: {
    id: number;
    name: string;
    sector: string | null;
    status: string;
    codes: number;
    created_at: string;
    deleted_at: string | null;
  }[];
};

export const CLIENT_STATE: Record<ClientState, { label: string; tone: BadgeTone }> = {
  none: { label: "Nessun piano", tone: "neutral" },
  trialing: { label: "In prova", tone: "info" },
  expired: { label: "Prova scaduta", tone: "warning" },
  active: { label: "Abbonato", tone: "success" },
  past_due: { label: "Pagamento in ritardo", tone: "warning" },
  canceled: { label: "Annullato", tone: "danger" },
  unpaid: { label: "Non pagato", tone: "danger" },
  gift: { label: "Omaggio", tone: "success" },
};
