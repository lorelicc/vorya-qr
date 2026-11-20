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
  invited: boolean;
  deleted_at: string | null;
  purge_after: string | null;
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
  invited: boolean;
  deleted_at: string | null;
  purge_after: string | null;
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

export type AdminQr = {
  id: number;
  name: string;
  slug: string;
  kind: "static" | "dynamic";
  qr_type: string;
  status: "active" | "paused" | "blocked" | "deleted";
  blocked_reason: string | null;
  company_id: number;
  company: string;
  scan_total: number;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  action: string;
  actor: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export const AUDIT_LABEL: Record<string, string> = {
  "admin.client_created": "Cliente creato e invitato",
  "admin.client_edited": "Dati modificati",
  "admin.client_archived": "Cliente archiviato",
  "admin.client_restored": "Cliente ripristinato",
  "client.purged": "Dati personali cancellati",
  "admin.invite_resent": "Invito reinviato",
  "admin.password_reset_sent": "Email di reset password inviata",
  "admin.sessions_revoked": "Sessioni chiuse",
  "admin.company_deleted": "Azienda eliminata",
  "admin.company_restored": "Azienda ripristinata",
  "admin.qr_block": "QR bloccato",
  "admin.qr_unblock": "QR sbloccato",
  "admin.qr_delete": "QR eliminato",
  "admin.plan_changed": "Piano cambiato",
  "admin.grant_created": "Omaggio assegnato",
  "admin.grant_revoked": "Omaggio revocato",
  "admin.workspace_suspend": "Account sospeso",
  "admin.workspace_reactivate": "Account riattivato",
  "billing.plan_changed": "Piano cambiato",
};
