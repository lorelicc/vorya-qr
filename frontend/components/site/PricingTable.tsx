import { Check, Minus } from "lucide-react";
import type { PlanCardData } from "@/lib/billing";
import styles from "./pricing.module.css";

type Row = { label: string; value: (p: PlanCardData) => string | boolean };

/** Every cell comes from the plan's own limits and features. */
const ROWS: Row[] = [
  { label: "Aziende", value: (p) => (p.limits.companies === null ? "Illimitate" : String(p.limits.companies)) },
  { label: "QR e link dinamici per azienda", value: (p) => (p.limits.dynamic_qr === null ? "Illimitati" : String(p.limits.dynamic_qr)) },
  { label: "QR statici", value: (p) => (p.limits.static_qr === null ? "Illimitati" : String(p.limits.static_qr)) },
  { label: "Pagine ospitate", value: (p) => (p.features.allowed_types.includes("pdf") ? "Tutti i tipi" : "vCard, Link in bio") },
  { label: "Menu e carta dei vini", value: (p) => p.features.allowed_types.includes("menu") },
  { label: "Back-half personalizzato", value: (p) => (p.features.custom_back_half ? (p.features.max_aliases_per_link == null ? "Illimitati" : `${p.features.max_aliases_per_link} per link`) : false) },
  { label: "Scadenza, password, programmazione", value: (p) => p.features.link_rules },
  { label: "Modelli UTM", value: (p) => p.features.utm_templates },
  { label: "Creazione da CSV", value: (p) => (p.features.max_bulk_rows > 0 ? `${p.features.max_bulk_rows} righe` : false) },
  { label: "Cronologia versioni", value: (p) => p.features.version_history },
  { label: "Statistiche", value: (p) => (p.features.stats_retention_days == null ? "Senza limiti" : `${p.features.stats_retention_days} giorni`) },
  { label: "Spazio file", value: (p) => (p.features.storage_mb == null ? "Illimitato" : p.features.storage_mb >= 1024 ? `${p.features.storage_mb / 1024} GB` : `${p.features.storage_mb} MB`) },
  { label: "Report via email", value: (p) => ((p.features.report_frequencies ?? []).length ? `${p.features.report_recipients} ${p.features.report_recipients === 1 ? "destinatario" : "destinatari"}` : false) },
  { label: "Senza «Creato con Vorya QR»", value: (p) => Boolean(p.features.remove_branding) },
  { label: "Pubblicità", value: () => "Mai" },
]; // prettier-ignore

export function PricingTable({ plans }: { plans: PlanCardData[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">Confronto completo dei piani</caption>
        <thead>
          <tr>
            <th scope="col">Funzionalità</th>
            {plans.map((p) => (
              <th key={p.id} scope="col">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {plans.map((p) => {
                const value = row.value(p);
                return (
                  <td key={p.id}>
                    {value === true ? (
                      <Check size={16} aria-label="Incluso" />
                    ) : value === false ? (
                      <Minus size={16} aria-label="Non incluso" />
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
