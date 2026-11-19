export type Role = "super_admin" | "platform_admin" | "company_admin";
export type Access = "active" | "trial" | "trial_expired" | "suspended";
export type QrKind = "static" | "dynamic";
export type ErrorCorrection = "L" | "M" | "Q" | "H";

export type Me = {
  id: number;
  display_name: string;
  email: string;
  role: Role;
  support_email: string;
  workspace: {
    id: number;
    name: string;
    plan_id: string;
    access: Access;
    trial_ends_at: string | null;
  } | null;
  last_company_id: number | null;
};

export type QrStyle = {
  fg_color: string;
  bg_color: string;
  margin: number;
  error_correction: ErrorCorrection;
};

export type QrCode = QrStyle & {
  id: number;
  name: string;
  kind: QrKind;
  content_type: "url";
  target_url: string;
  slug: string | null;
  short_url: string | null;
  status: "active" | "paused";
  scan_count: number;
  created_at: string;
  updated_at: string;
};

export type UsageItem = {
  used: number;
  limit: number | null;
  over_limit: boolean;
  can_create: boolean;
};

export type PlanFeatures = {
  allowed_types: string[];
  storage_mb: number | null;
  max_file_mb: number;
  remove_branding: boolean;
  stats_retention_days: number | null;
  max_style_presets: number | null;
};

export type AccountPlan = {
  plan: { id: string; name: string; description: string };
  features: PlanFeatures;
  type_labels: Record<string, string>;
  access: Access;
  trial_ends_at: string | null;
  usage: Record<QrKind | "companies" | "storage", UsageItem>;
  support_email: string;
};

export type Warning = { code: "low_contrast" | "inverted" | "small_margin"; message: string };

export type Breakdown = { label: string; count: number }[];

export type QrStats = {
  total_scans: number;
  bot_scans: number;
  last_scan_at: string | null;
  scans_last_30_days: number;
  timezone: string;
  daily: { date: string; count: number }[];
  devices: Breakdown;
  os: Breakdown;
  browsers: Breakdown;
};

export type Plan = {
  id: string;
  name: string;
  description: string;
  max_qr_static: number | null;
  max_dynamic_qr: number | null;
  position: number;
};

export type AdminWorkspace = {
  id: number;
  name: string;
  owner: { id: number; display_name: string; email: string };
  plan_id: string;
  status: "active" | "suspended";
  access: Access;
  trial_ends_at: string | null;
  suspended_at: string | null;
  created_at: string;
  qr_count?: number;
  usage?: Record<QrKind, UsageItem>;
};

export type Company = {
  id: number;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  sector: string | null;
  qr_count: number;
  scans_7d: number;
  created_at: string;
  deleted_at: string | null;
  purge_after: string | null;
};

export type TransferStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

export type Transfer = {
  id: number;
  company: { id: number; name: string };
  from: { name: string; email: string };
  to_email: string;
  status: TransferStatus;
  failure_reason: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
};
