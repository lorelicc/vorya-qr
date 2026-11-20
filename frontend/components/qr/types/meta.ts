import {
  AtSign, Contact, FileText, Globe, Images, Link2, MessageCircle, MessageSquare, Music2, Phone, Store, Type, UtensilsCrossed, Wifi,
} from "lucide-react"; // prettier-ignore
import type { Template } from "@/lib/page-types";

export type QrTypeKey =
  | "website" | "vcard" | "pdf" | "music" | "link_in_bio" | "gallery" | "business" | "menu"
  | "wifi" | "text" | "email" | "sms" | "phone" | "whatsapp" | "vcard_static"; // prettier-ignore

export type TypeMeta = {
  key: QrTypeKey;
  label: string;
  description: string;
  icon: typeof Globe;
  group: "page" | "redirect" | "static";
};

export const TYPES: TypeMeta[] = [
  { key: "website", label: "Sito web", description: "Porta a un link, modificabile in qualsiasi momento.", icon: Globe, group: "redirect" },
  { key: "vcard", label: "vCard", description: "Biglietto da visita digitale da salvare nei contatti.", icon: Contact, group: "page" },
  { key: "link_in_bio", label: "Link in bio", description: "Una pagina con tutti i tuoi link e social.", icon: Link2, group: "page" },
  { key: "pdf", label: "PDF", description: "Menu, listino o brochure da sfogliare e scaricare.", icon: FileText, group: "page" },
  { key: "music", label: "Musica", description: "Tracce da ascoltare e link alle piattaforme.", icon: Music2, group: "page" },
  { key: "gallery", label: "Galleria", description: "Una raccolta di immagini a tutto schermo.", icon: Images, group: "page" },
  { key: "business", label: "Pagina attività", description: "Descrizione, orari, indirizzo, contatti e social.", icon: Store, group: "page" },
  { key: "menu", label: "Menu / Carta dei vini", description: "Sezioni, prezzi, allergeni, vini e una seconda lingua. Si aggiorna dal telefono.", icon: UtensilsCrossed, group: "page" },
  { key: "vcard_static", label: "vCard statica", description: "Il biglietto da visita scritto nel QR: gratis e per sempre, ma non modificabile.", icon: Contact, group: "static" },
  { key: "wifi", label: "Wi-Fi", description: "Connette alla rete senza digitare la password.", icon: Wifi, group: "static" },
  { key: "text", label: "Testo", description: "Un messaggio di testo leggibile offline.", icon: Type, group: "static" },
  { key: "email", label: "Email", description: "Apre un’email già indirizzata e compilata.", icon: AtSign, group: "static" },
  { key: "sms", label: "SMS", description: "Prepara un SMS con numero e testo.", icon: MessageSquare, group: "static" },
  { key: "phone", label: "Telefono", description: "Avvia una chiamata con un tocco.", icon: Phone, group: "static" },
  { key: "whatsapp", label: "WhatsApp", description: "Apre una chat WhatsApp con un messaggio.", icon: MessageCircle, group: "static" },
]; // prettier-ignore

export const TYPE_BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t])) as Record<
  QrTypeKey,
  TypeMeta
>;
export const isPageType = (key: QrTypeKey): key is Template => TYPE_BY_KEY[key].group === "page";
