import { contrastRatio } from "./contrast";
import type { Company, QrCode, QrDesign } from "./types";

export const DEFAULT_DESIGN: QrDesign = {
  version: 1,
  modules: "square",
  eye_frame: "square",
  eye_ball: "square",
  fill: { type: "solid", color: "#091411", color2: "#087f5b", angle: 45 },
  eye_color: null,
  background: "#ffffff",
  transparent: false,
  margin: 4,
  error_correction: "M",
  logo: null,
};

/** New QR codes start from the company branding (falling back to black if it is too light). */
export function designForCompany(
  company: Pick<Company, "primary_color" | "secondary_color">,
): QrDesign {
  const color =
    contrastRatio(company.primary_color, "#ffffff") >= 4 ? company.primary_color : "#091411";
  return { ...DEFAULT_DESIGN, fill: { ...DEFAULT_DESIGN.fill, color, color2: "#091411" } };
}

/** 0.1 QR codes have no design yet: derive it from their colors, margin and correction. */
export function designOf(qr: QrCode): QrDesign {
  if (qr.design) return qr.design as unknown as QrDesign;
  return {
    ...DEFAULT_DESIGN,
    fill: { ...DEFAULT_DESIGN.fill, color: qr.fg_color },
    background: qr.bg_color,
    margin: qr.margin,
    error_correction: qr.error_correction,
  };
}
