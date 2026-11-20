"use client";
import { ImageUp, X } from "lucide-react";
import { useState } from "react";
import {
  BALL_OPTIONS,
  FRAME_OPTIONS,
  MODULE_OPTIONS,
  ShapePicker,
} from "@/components/qr/design/ShapePicker";
import { ColorField } from "@/components/qr/ColorField";
import { Button, Select } from "@/components/ui";
import type { QrDesign } from "@/lib/types";
import styles from "./generator.module.css";

const MAX_LOGO = 256 * 1024;

/** Style controls of the free generator: shapes, colors and an in-memory logo. */
export function GeneratorDesign({
  design,
  onChange,
  logo,
  onLogo,
}: {
  design: QrDesign;
  onChange: (design: QrDesign) => void;
  logo: string | null;
  onLogo: (logo: string | null) => void;
}) {
  const [logoError, setLogoError] = useState("");
  const setDesign = onChange;
  function pickLogo(file: File | undefined) {
    setLogoError("");
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type))
      return setLogoError("Usa un'immagine PNG, JPG o WebP.");
    if (file.size > MAX_LOGO)
      return setLogoError("Il logo supera i 256 KB: usa un'immagine più piccola.");
    const reader = new FileReader();
    reader.onload = () => onLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <>
      <ShapePicker
        label="Moduli"
        value={design.modules}
        options={MODULE_OPTIONS}
        onChange={(modules) => setDesign({ ...design, modules })}
      />
      <ShapePicker
        label="Cornice degli occhi"
        value={design.eye_frame}
        options={FRAME_OPTIONS}
        onChange={(eye_frame) => setDesign({ ...design, eye_frame })}
      />
      <ShapePicker
        label="Centro degli occhi"
        value={design.eye_ball}
        options={BALL_OPTIONS}
        onChange={(eye_ball) => setDesign({ ...design, eye_ball })}
      />
      <Select
        label="Colore dei moduli"
        value={design.fill.type}
        onChange={(e) =>
          setDesign({
            ...design,
            fill: { ...design.fill, type: e.target.value as QrDesign["fill"]["type"] },
          })
        }
      >
        <option value="solid">Tinta unita</option>
        <option value="linear">Gradiente lineare</option>
        <option value="radial">Gradiente radiale</option>
      </Select>
      <div className={styles.colors}>
        <ColorField
          label={design.fill.type === "solid" ? "Colore" : "Colore iniziale"}
          value={design.fill.color}
          onChange={(color) => setDesign({ ...design, fill: { ...design.fill, color } })}
        />
        {design.fill.type !== "solid" && (
          <ColorField
            label="Colore finale"
            value={design.fill.color2}
            onChange={(color2) => setDesign({ ...design, fill: { ...design.fill, color2 } })}
          />
        )}
        <ColorField
          label="Sfondo"
          value={design.background}
          onChange={(background) => setDesign({ ...design, background })}
        />
      </div>
      <div className={styles.logo}>
        {logo ? (
          <Button variant="secondary" icon={<X size={16} />} onClick={() => onLogo(null)}>
            Rimuovi il logo
          </Button>
        ) : (
          <label className={styles.upload}>
            <ImageUp size={16} aria-hidden="true" /> Aggiungi un logo (PNG, JPG, WebP, max 256 KB)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
          </label>
        )}
        {logoError && (
          <p role="alert" className={styles.error}>
            {logoError}
          </p>
        )}
        <p className={styles.hint}>
          Il logo resta nel tuo browser: non viene salvato da nessuna parte.
        </p>
      </div>
    </>
  );
}
