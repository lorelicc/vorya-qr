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

export type AccountPlan = {
  plan: { id: string; name: string; description: string };
  access: Access;
  trial_ends_at: string | null;
  usage: Record<QrKind, UsageItem>;
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
