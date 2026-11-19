/** Mirrors backend/app/schemas/page.py (schema_version 1). */
export type Template = "vcard" | "pdf" | "music" | "link_in_bio" | "gallery" | "business";
export type Font = "inter" | "montserrat" | "playfair" | "space-grotesk";
export type ButtonStyle = "rounded" | "pill" | "square" | "outline";
export type MusicPlatform =
  | "spotify"
  | "apple_music"
  | "youtube_music"
  | "amazon_music"
  | "soundcloud";
export type SocialNetwork =
  | "instagram" | "facebook" | "tiktok" | "linkedin" | "x" | "youtube" | "threads" | "pinterest"
  | "telegram" | "whatsapp" | "website"; // prettier-ignore
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type B<T extends string, F> = { id: string; type: T } & F;
export type HeaderBlock = B<
  "header",
  { cover_file_id?: string | null; avatar_file_id?: string | null; title: string; subtitle: string }
>;
export type TextBlock = B<"text", { markdown: string }>;
export type ButtonBlock = B<"button", { label: string; url: string }>;
export type LinkListBlock = B<"link_list", { items: { label: string; url: string }[] }>;
export type ContactBlock = B<"contact", {
  first_name: string; last_name: string; organization: string; job_title: string;
  phones: { label: "cell" | "work" | "home" | "other"; number: string }[];
  emails: { label: "work" | "home" | "other"; address: string }[];
  website: string;
  address: { street: string; city: string; postal_code: string; region: string; country: string };
  note: string; save_button_label: string;
}>; // prettier-ignore
export type FileBlock = B<"file", { file_id: string; label: string; allow_download: boolean }>;
export type AudioPlayerBlock = B<
  "audio_player",
  { tracks: { file_id: string; title: string; artist: string }[] }
>;
export type MusicLinksBlock = B<
  "music_links",
  { links: { platform: MusicPlatform; url: string }[] }
>;
export type GalleryBlock = B<"gallery", { file_ids: string[]; layout: "grid" | "stack" }>;
export type SocialIconsBlock = B<
  "social_icons",
  { items: { network: SocialNetwork; url: string }[] }
>;
export type OpeningHoursBlock = B<"opening_hours", {
  days: { day: DayKey; closed: boolean; ranges: { opens: string; closes: string }[] }[];
  note: string;
}>; // prettier-ignore
export type AddressBlock = B<
  "address",
  { label: string; query: string; providers: ("google" | "apple")[] }
>;
export type DividerBlock = B<"divider", { style: "line" | "space" }>;

export type PageBlock =
  | HeaderBlock | TextBlock | ButtonBlock | LinkListBlock | ContactBlock | FileBlock
  | AudioPlayerBlock | MusicLinksBlock | GalleryBlock | SocialIconsBlock | OpeningHoursBlock
  | AddressBlock | DividerBlock; // prettier-ignore

export type Theme = {
  primary: string;
  secondary: string;
  background: {
    type: "solid" | "gradient" | "image";
    color: string;
    to: string;
    angle: number;
    file_id?: string | null;
    overlay: number;
  };
  button_style: ButtonStyle;
  font: Font;
};

export type PageDoc = {
  schema_version: 1;
  template: Template;
  theme: Theme;
  settings: {
    indexable: boolean;
    show_branding: boolean;
    og: { title: string; description: string; image_file_id?: string | null };
  };
  blocks: PageBlock[];
};

export type PageFile = {
  kind: "image" | "pdf" | "audio";
  urls: Record<string, string>;
  name: string;
  pages: number | null;
  width?: number | null;
  height?: number | null;
};
export type PageFiles = Record<string, PageFile>;

export type PublicPage = {
  slug: string;
  page: PageDoc;
  files: PageFiles;
  company: { name: string; logo_url: string | null };
};

export const DAY_LABEL: Record<DayKey, string> = {
  mon: "Lunedì", tue: "Martedì", wed: "Mercoledì", thu: "Giovedì", fri: "Venerdì", sat: "Sabato", sun: "Domenica",
}; // prettier-ignore

export const MUSIC_LABEL: Record<MusicPlatform, string> = {
  spotify: "Spotify", apple_music: "Apple Music", youtube_music: "YouTube Music",
  amazon_music: "Amazon Music", soundcloud: "SoundCloud",
}; // prettier-ignore

export const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", linkedin: "LinkedIn", x: "X",
  youtube: "YouTube", threads: "Threads", pinterest: "Pinterest", telegram: "Telegram",
  whatsapp: "WhatsApp", website: "Sito web",
}; // prettier-ignore
