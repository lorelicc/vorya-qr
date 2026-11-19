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
  qr_type: string;
  destination: "redirect" | "page";
  static_data: Record<string, string | boolean> | null;
  design: Record<string, unknown> | null;
  target_url: string;
  slug: string | null;
  short_url: string | null;
  status: "active" | "paused" | "blocked";
  has_qr: boolean;
  folder_id?: number | null;
  tag_ids?: number[];
  scan_total: number;
  root_url: string | null;
  blocked_reason?: string | null;
  scan_count: number;
  spark?: number[] | null;
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
  custom_back_half: boolean;
  max_aliases_per_link: number | null;
  link_rules: boolean;
  utm_templates: boolean;
  max_bulk_rows: number;
  version_history: boolean;
  menu_type: boolean;
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

export type Breakdown = { label: string; key?: string | null; count: number }[];

export type StatsRange = "7d" | "30d" | "90d" | "custom";

export type StatsDay = { date: string; count: number; unique: number; clicks: number };

export type StatsSummary = {
  range: { first: string; last: string; timezone: string };
  scans: number;
  unique_estimate: number;
  clicks: number;
  bot_scans: number;
  blocked_scans?: number;
  daily: StatsDay[];
  devices: Breakdown;
  os: Breakdown;
  browsers: Breakdown;
  countries: Breakdown;
  cities: { label: string; country: string | null; count: number }[];
  top_clicks: Breakdown;
  retention_days: number | null;
  geo_available: boolean;
  attribution: { text: string; url: string };
};

export type StatsMarker = {
  date: string;
  change: "type" | "destination" | "restore";
  qr_type: string;
};

export type QrStats = StatsSummary & {
  markers?: StatsMarker[];
  total_scans: number;
  last_scan_at: string | null;
  scans_last_30_days: number | null;
};

export type CompanyStats = StatsSummary & {
  top_qr: { id: number; name: string; qr_type: string; count: number }[];
};

export type Plan = {
  id: string;
  name: string;
  description: string;
  max_qr_static: number | null;
  max_dynamic_qr: number | null;
  max_companies?: number | null;
  features?: PlanFeatures;
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

export type ModuleShape = "square" | "rounded" | "dots" | "classy" | "extra_rounded";
export type EyeFrame = "square" | "rounded" | "circle" | "leaf" | "extra_rounded";
export type EyeBall = "square" | "rounded" | "circle" | "leaf";

export type QrDesign = {
  version: 1;
  modules: ModuleShape;
  eye_frame: EyeFrame;
  eye_ball: EyeBall;
  fill: { type: "solid" | "linear" | "radial"; color: string; color2: string; angle: number };
  eye_color: string | null;
  background: string;
  transparent: boolean;
  margin: number;
  error_correction: ErrorCorrection;
  logo: { file_id: string; size: number; padding: number; plate: boolean } | null;
};

export type Scannability = {
  scannable: boolean;
  reasons: { code: string; message: string; blocking: boolean }[];
};

export type StylePresetItem = { id: number; name: string; design: QrDesign; created_at: string };

export type AbuseReport = {
  id: number;
  created_at: string;
  slug: string | null;
  reason: "phishing" | "malware" | "spam" | "illegal" | "other";
  details: string;
  reporter_email: string | null;
  status: "open" | "resolved";
  resolution: "dismiss" | "block_qr" | "suspend_workspace" | null;
  resolved_at: string | null;
  qr: {
    id: number;
    name: string;
    status: string;
    qr_type: string;
    destination: string;
    target_url: string;
    deleted: boolean;
  } | null;
  company: { id: number; name: string } | null;
  workspace: { id: number; name: string; status: string } | null;
};

export type BlockedDomain = { id: number; domain: string; reason: string; created_at: string };

export type AdminTransfer = {
  id: number;
  company: string;
  from_workspace: { id: number; name: string | null };
  to_workspace: { id: number | null; name: string | null };
  to_email: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
  decided_at: string | null;
};

export type FolderItem = {
  id: number;
  name: string;
  parent_id: number | null;
  position: number;
  link_count: number;
};
export type TagItem = { id: number; name: string; color: string; link_count: number };
export type SearchHit = {
  id: number;
  company_id: number;
  company: string;
  name: string;
  slug: string | null;
  qr_type: string;
  kind: "static" | "dynamic";
  status: string;
  has_qr: boolean;
  target_url: string;
};
