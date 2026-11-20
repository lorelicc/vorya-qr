import {
  AtSign, BarChart3, BookOpen, Briefcase, Building2, Contact, Euro, FileSpreadsheet, FileText, Globe,
  HelpCircle, Home, Images, LayoutGrid, LayoutTemplate, Link2, Mail, MessageCircle, MessageSquare,
  Music2, Palette, PartyPopper, Phone, QrCode, RefreshCw, Scale, ShoppingBag, Store, Type, Users,
  UtensilsCrossed, Wifi, Wine,
} from "lucide-react"; // prettier-ignore
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  link: Link2, refresh: RefreshCw, layout: LayoutTemplate, palette: Palette, chart: BarChart3,
  building: Building2, sheet: FileSpreadsheet, menu: UtensilsCrossed, wine: Wine, party: PartyPopper,
  briefcase: Briefcase, bag: ShoppingBag, home: Home, book: BookOpen, help: HelpCircle, scale: Scale,
  qr: QrCode, users: Users, mail: Mail, grid: LayoutGrid, euro: Euro,
  "sito-web": Globe, vcard: Contact, pdf: FileText, musica: Music2, "link-in-bio": Link2,
  galleria: Images, attivita: Store, "carta-dei-vini": Wine, wifi: Wifi, testo: Type, email: AtSign,
  sms: MessageSquare, telefono: Phone, whatsapp: MessageCircle,
}; // prettier-ignore

export function NavIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? LayoutGrid;
  return <Icon size={size} aria-hidden="true" />;
}
