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
  custom_back_half: false,
  max_aliases_per_link: 0,
  link_rules: false,
  utm_templates: false,
  max_bulk_rows: 0,
  version_history: false,
  menu_type: false,
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
      <div className={styles.features}>
        <Input
          label="Back-half per link"
          name="max_aliases_per_link"
          type="number"
          min={0}
          defaultValue={features.max_aliases_per_link ?? ""}
          hint="Vuoto = illimitati"
        />
        <Input
          label="Righe massime per import"
          name="max_bulk_rows"
          type="number"
          min={0}
          required
          defaultValue={features.max_bulk_rows}
        />
      </div>
      {(
        [
          ["custom_back_half", "Back-half personalizzato"],
          ["link_rules", "Regole del link (scadenza, password, programmazione)"],
          ["utm_templates", "Modelli UTM"],
          ["version_history", "Cronologia delle versioni"],
          ["menu_type", "Tipo Menu / Carta dei vini"],
        ] as const
      ).map(([name, label]) => (
        <label key={name} className={styles.check}>
          <input type="checkbox" name={name} defaultChecked={features[name]} />
          {label}
        </label>
      ))}
      <label className={styles.check}>
        <input type="checkbox" name="remove_branding" defaultChecked={features.remove_branding} />
        Può nascondere “Creato con Vorya QR” nelle pagine
      </label>
      <fieldset className={styles.types}>
        <legend>Tipi di QR inclusi</legend>
        {TYPES.filter((type) => type.key !== "menu").map((type) => (
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
