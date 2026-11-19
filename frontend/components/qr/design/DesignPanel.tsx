"use client";
import { Lock } from "lucide-react";
import { useId } from "react";
import { Dropzone } from "@/components/files/Dropzone";
import { Select } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { DEFAULT_DESIGN } from "@/lib/design";
import type { PageFiles } from "@/lib/page-types";
import type { QrDesign } from "@/lib/types";
import type { UploadedFile } from "@/lib/upload";
import { ColorField } from "../ColorField";
import { PresetBar } from "./PresetBar";
import { BALL_OPTIONS, FRAME_OPTIONS, MODULE_OPTIONS, ShapePicker } from "./ShapePicker";
import styles from "./design.module.css";

type Props = {
  value: QrDesign;
  onChange: (design: QrDesign) => void;
  files: PageFiles;
  addFile: (file: UploadedFile) => void;
};

function Range({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className={styles.range}>
      <label htmlFor={id}>
        {label} <strong>{format(value)}</strong>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
} // prettier-ignore

/** QR designer: shapes, colors, background, margin, correction, logo and presets. */
export function DesignPanel({ value: d, onChange, files, addFile }: Props) {
  const { api } = useCompany();
  const set = (patch: Partial<QrDesign>) => onChange({ ...d, ...patch });
  const fill = (patch: Partial<QrDesign["fill"]>) => set({ fill: { ...d.fill, ...patch } });
  const logo = d.logo;
  const logoUrl = logo
    ? (files[logo.file_id]?.urls.thumb ?? files[logo.file_id]?.urls.logo)
    : undefined;

  return (
    <div className={styles.panel}>
      <PresetBar design={d} onApply={onChange} />
      <ShapePicker
        label="Moduli"
        value={d.modules}
        options={MODULE_OPTIONS}
        onChange={(modules) => set({ modules })}
      />
      <ShapePicker
        label="Cornice degli occhi"
        value={d.eye_frame}
        options={FRAME_OPTIONS}
        onChange={(eye_frame) => set({ eye_frame })}
      />
      <ShapePicker
        label="Centro degli occhi"
        value={d.eye_ball}
        options={BALL_OPTIONS}
        onChange={(eye_ball) => set({ eye_ball })}
      />
      <div className={styles.two}>
        <Select
          label="Colore dei moduli"
          value={d.fill.type}
          onChange={(e) => fill({ type: e.target.value as QrDesign["fill"]["type"] })}
        >
          <option value="solid">Tinta unita</option>
          <option value="linear">Gradiente lineare</option>
          <option value="radial">Gradiente radiale</option>
        </Select>
        <ColorField
          label={d.fill.type === "solid" ? "Colore" : "Colore iniziale"}
          value={d.fill.color}
          onChange={(color) => fill({ color })}
        />
        {d.fill.type !== "solid" && (
          <ColorField
            label="Colore finale"
            value={d.fill.color2}
            onChange={(color2) => fill({ color2 })}
          />
        )}
        {d.fill.type === "linear" && (
          <Range
            label="Angolo"
            value={d.fill.angle}
            min={0}
            max={360}
            step={15}
            format={(v) => `${v}°`}
            onChange={(angle) => fill({ angle })}
          />
        )}
      </div>
      <div className={styles.two}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={d.eye_color !== null}
            onChange={(e) => set({ eye_color: e.target.checked ? d.fill.color : null })}
          />{" "}
          Colore separato per gli occhi
        </label>
        {d.eye_color !== null && (
          <ColorField
            label="Colore degli occhi"
            value={d.eye_color}
            onChange={(eye_color) => set({ eye_color })}
          />
        )}
      </div>
      <div className={styles.two}>
        <ColorField
          label="Sfondo"
          value={d.background}
          onChange={(background) => set({ background })}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={d.transparent}
            onChange={(e) => set({ transparent: e.target.checked })}
          />{" "}
          Sfondo trasparente (PNG e SVG)
        </label>
      </div>
      <Range
        label="Margine"
        value={d.margin}
        min={0}
        max={16}
        step={1}
        format={(v) => `${v} moduli`}
        onChange={(margin) => set({ margin })}
      />
      <Select
        label="Correzione d’errore"
        value={logo ? "H" : d.error_correction}
        disabled={Boolean(logo)}
        onChange={(e) => set({ error_correction: e.target.value as QrDesign["error_correction"] })}
        hint={
          logo
            ? "Con il logo la correzione è sempre massima (H)."
            : "Più alta è la correzione, più il QR resiste a graffi e pieghe."
        }
      >
        <option value="L">Bassa (L, ~7%)</option>
        <option value="M">Media (M, ~15%), consigliata</option>
        <option value="Q">Alta (Q, ~25%)</option>
        <option value="H">Massima (H, ~30%)</option>
      </Select>
      <div className={styles.logo}>
        <span className={styles.legend}>
          Logo al centro {logo && <Lock size={12} aria-label="Correzione H" />}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logoUrl && <img src={logoUrl} alt="" width={56} height={56} />}
        <Dropzone<UploadedFile>
          compact
          path={`${api}/files`}
          purpose="logo"
          label={logo ? "Sostituisci il logo" : "Aggiungi un logo"}
          hint="PNG, JPG o WebP"
          onUploaded={(file) => {
            addFile(file);
            set({
              logo: { file_id: file.id, size: 0.22, padding: 0.02, plate: true },
              error_correction: "H",
            });
          }}
        />
        {logo && (
          <>
            <Range
              label="Dimensione"
              value={logo.size}
              min={0.1}
              max={0.3}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(size) => set({ logo: { ...logo, size } })}
            />
            <Range
              label="Spazio attorno"
              value={logo.padding}
              min={0}
              max={0.08}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(padding) => set({ logo: { ...logo, padding } })}
            />
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={logo.plate}
                onChange={(e) => set({ logo: { ...logo, plate: e.target.checked } })}
              />{" "}
              Riquadro chiaro dietro al logo
            </label>
            <button
              type="button"
              className={styles.link}
              onClick={() => set({ logo: null, error_correction: DEFAULT_DESIGN.error_correction })}
            >
              Rimuovi il logo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
