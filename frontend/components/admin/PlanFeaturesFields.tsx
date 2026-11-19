import { TYPES } from "@/components/qr/types/meta";
import { Input } from "@/components/ui";
import type { PlanFeatures } from "@/lib/types";
import styles from "./admin.module.css";

const DEFAULTS: PlanFeatures = {
  allowed_types: [],
  storage_mb: 100,
  max_file_mb: 10,
  remove_branding: false,
  stats_retention_days: 90,
  max_style_presets: 3,
};

/** Feature flags and numeric limits of a plan (stored as JSON, validated by the backend). */
export function PlanFeaturesFields({ features = DEFAULTS }: { features?: PlanFeatures }) {
  return (
    <>
      <div className={styles.features}>
        <Input
          label="Spazio file (MB)"
          name="storage_mb"
          type="number"
          min={0}
          defaultValue={features.storage_mb ?? ""}
          hint="Vuoto = illimitato"
        />
        <Input
          label="Dimensione massima file (MB)"
          name="max_file_mb"
          type="number"
          min={1}
          max={500}
          required
          defaultValue={features.max_file_mb}
        />
        <Input
          label="Conservazione statistiche (giorni)"
          name="stats_retention_days"
          type="number"
          min={1}
          defaultValue={features.stats_retention_days ?? ""}
          hint="Vuoto = illimitata"
        />
        <Input
          label="Stili salvati"
          name="max_style_presets"
          type="number"
          min={0}
          defaultValue={features.max_style_presets ?? ""}
          hint="Vuoto = illimitati"
        />
      </div>
      <label className={styles.check}>
        <input type="checkbox" name="remove_branding" defaultChecked={features.remove_branding} />
        Può nascondere “Creato con Vorya QR” nelle pagine
      </label>
      <fieldset className={styles.types}>
        <legend>Tipi di QR inclusi</legend>
        {TYPES.map((type) => (
          <label key={type.key}>
            <input
              type="checkbox"
              name="allowed_types"
              value={type.key}
              defaultChecked={features.allowed_types.includes(type.key)}
            />
            {type.label}
          </label>
        ))}
      </fieldset>
    </>
  );
}
