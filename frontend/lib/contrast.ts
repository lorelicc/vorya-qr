/** Same rules as backend/app/qr/contrast.py, for instant feedback while editing. */
import type { Warning } from "./types";

export const MIN_CONTRAST = 4;
export const MIN_MARGIN = 2;

const MESSAGES: Record<Warning["code"], string> = {
  low_contrast:
    "Contrasto insufficiente tra primo piano e sfondo: il QR potrebbe non essere letto.",
  inverted:
    "Il primo piano è più chiaro dello sfondo: molte app di scansione non leggono i QR invertiti.",
  small_margin: "Margine ridotto: lascia almeno 2 moduli (consigliati 4) di spazio attorno al QR.",
};

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function qrWarnings(fg: string, bg: string, margin: number): Warning[] {
  if (!isHexColor(fg) || !isHexColor(bg)) return [];
  const codes: Warning["code"][] = [];
  if (contrastRatio(fg, bg) < MIN_CONTRAST) codes.push("low_contrast");
  if (luminance(fg) > luminance(bg)) codes.push("inverted");
  if (margin < MIN_MARGIN) codes.push("small_margin");
  return codes.map((code) => ({ code, message: MESSAGES[code] }));
}
