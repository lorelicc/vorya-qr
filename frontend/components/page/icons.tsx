import {
  AtSign, Facebook, Globe, Instagram, Linkedin, MessageCircle, Music2, Pin, Send, Twitter, Video, Youtube,
} from "lucide-react"; // prettier-ignore
import type { SocialNetwork } from "@/lib/page-types";

export const SOCIAL_ICON: Record<SocialNetwork, typeof Globe> = {
  instagram: Instagram, facebook: Facebook, tiktok: Video, linkedin: Linkedin, x: Twitter,
  youtube: Youtube, threads: AtSign, pinterest: Pin, telegram: Send, whatsapp: MessageCircle,
  website: Globe,
}; // prettier-ignore

export const MusicIcon = Music2;
