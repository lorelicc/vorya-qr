import {
  AtSign, BarChart3, BookOpen, Briefcase, Building2, Contact, Euro, EyeOff, FileSpreadsheet, FileText,
  Flag, Globe, Home, Images, LayoutTemplate, Link2, Lock, Mail, MessageCircle, MessageSquare, Music2,
  Palette, PartyPopper, Phone, RefreshCw, SearchX, ShieldCheck, ShoppingBag, Store, Tag, Type, Users,
  UtensilsCrossed, Wifi, Wine,
} from "lucide-react"; // prettier-ignore
import type { LucideIcon } from "lucide-react";
import { Illustration, art } from "@/components/illustrations/Illustration";
import { Badge, Blob, CHECK, MiniQr, Paper, Stroke } from "@/components/illustrations/parts";

type Tone = "mint" | "lilac" | "peach" | "glow";
type Spec = { icon: LucideIcon; tone: Tone; badge?: "green" | "lilac" | "peach" };

/** One entry per illustration: types, features, sectors and page headers share the same scene. */
const SPECS: Record<string, Spec> = {
  website: { icon: Globe, tone: "mint" },
  vcard: { icon: Contact, tone: "lilac" },
  pdf: { icon: FileText, tone: "peach" },
  music: { icon: Music2, tone: "lilac" },
  link_in_bio: { icon: Link2, tone: "mint" },
  gallery: { icon: Images, tone: "peach" },
  business: { icon: Store, tone: "mint" },
  menu: { icon: UtensilsCrossed, tone: "peach" },
  wine: { icon: Wine, tone: "lilac" },
  wifi: { icon: Wifi, tone: "mint" },
  text: { icon: Type, tone: "lilac" },
  email: { icon: AtSign, tone: "peach" },
  sms: { icon: MessageSquare, tone: "mint" },
  phone: { icon: Phone, tone: "lilac" },
  whatsapp: { icon: MessageCircle, tone: "mint" },
  // features
  links: { icon: Link2, tone: "mint" },
  dynamic: { icon: RefreshCw, tone: "lilac" },
  pages: { icon: LayoutTemplate, tone: "peach" },
  design: { icon: Palette, tone: "lilac" },
  stats: { icon: BarChart3, tone: "mint" },
  multi: { icon: Building2, tone: "peach" },
  import: { icon: FileSpreadsheet, tone: "mint" },
  // sectors
  ristoranti: { icon: UtensilsCrossed, tone: "peach" },
  cantine: { icon: Wine, tone: "lilac" },
  eventi: { icon: PartyPopper, tone: "peach" },
  agenzie: { icon: Briefcase, tone: "mint" },
  negozi: { icon: ShoppingBag, tone: "lilac" },
  immobiliare: { icon: Home, tone: "mint" },
  // messages and pages
  guarantee: { icon: ShieldCheck, tone: "mint", badge: "green" },
  noads: { icon: EyeOff, tone: "lilac" },
  euro: { icon: Euro, tone: "peach" },
  italy: { icon: Flag, tone: "mint" },
  agency: { icon: Users, tone: "lilac" },
  privacy: { icon: Lock, tone: "mint" },
  contact: { icon: Mail, tone: "peach" },
  guide: { icon: BookOpen, tone: "lilac" },
  notfound: { icon: SearchX, tone: "peach" },
  pricing: { icon: Tag, tone: "mint" },
  alternative: { icon: Briefcase, tone: "lilac" },
};

export const ART_NAMES = Object.keys(SPECS);

/** Small animated scene (< 2 KB): a floating card with a glyph, a pulsing badge and a QR. */
export function SiteArt({ name, size = 200 }: { name: string; size?: number }) {
  const spec = SPECS[name] ?? SPECS.website;
  const Icon = spec.icon;
  return (
    <Illustration size={size}>
      <Blob x={120} y={98} r={60} tone={spec.tone} />
      <Blob x={190} y={52} r={20} tone={spec.tone === "peach" ? "lilac" : "peach"} slow />
      <g className={art.float}>
        <Paper x={74} y={44} w={92} h={92} r={16} />
        <Icon x={96} y={64} width={48} height={48} strokeWidth={1.6} stroke="var(--art-dark)" />
        <rect x={92} y={120} width={56} height={6} rx={3} fill="var(--art-line)" />
      </g>
      <g className={art.floatSlow}>
        <Paper x={150} y={92} w={46} h={46} r={10} />
        <MiniQr x={157} y={99} cell={4} tone="dark" />
      </g>
      <Badge x={74} y={52} tone={spec.badge ?? "green"}>
        {CHECK}
      </Badge>
      <Stroke d="M40 74c8-12 20-16 32-12" />
    </Illustration>
  );
}
