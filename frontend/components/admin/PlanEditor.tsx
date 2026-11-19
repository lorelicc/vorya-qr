"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { PlanFeaturesFields } from "./PlanFeaturesFields";
import styles from "./admin.module.css";

function parseLimit(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

export function PlanEditor({
  plan,
  canWrite,
  onSaved,
}: {
  plan: Plan;
  canWrite: boolean;
  onSaved: (plan: Plan) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const saved = await api<Plan>(`admin/plans/${plan.id}`, "PUT", {
        name: form.get("name"),
        description: form.get("description"),
        max_qr_static: parseLimit(form.get("max_qr_static")),
        max_dynamic_qr: parseLimit(form.get("max_dynamic_qr")),
        max_companies: parseLimit(form.get("max_companies")),
        features: {
          allowed_types: form.getAll("allowed_types"),
          storage_mb: parseLimit(form.get("storage_mb")),
          max_file_mb: Number(form.get("max_file_mb")),
          remove_branding: form.get("remove_branding") === "on",
          stats_retention_days: parseLimit(form.get("stats_retention_days")),
          max_style_presets: parseLimit(form.get("max_style_presets")),
          max_aliases_per_link: parseLimit(form.get("max_aliases_per_link")),
          max_bulk_rows: Number(form.get("max_bulk_rows") ?? 0),
          custom_back_half: form.get("custom_back_half") === "on",
          link_rules: form.get("link_rules") === "on",
          utm_templates: form.get("utm_templates") === "on",
          version_history: form.get("version_history") === "on",
          menu_type: form.get("menu_type") === "on",
        },
      });
      onSaved(saved);
      toast.show(`Piano ${saved.name} aggiornato.`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={plan.name}>
      <form className="stack" onSubmit={submit}>
        <fieldset className={styles.fieldset} disabled={!canWrite}>
          <Input label="Nome" name="name" defaultValue={plan.name} required maxLength={80} />
          <Input
            label="Descrizione"
            name="description"
            defaultValue={plan.description}
            maxLength={500}
          />
          <div className={styles.limits}>
            <Input
              label="QR statici"
              name="max_qr_static"
              type="number"
              min={0}
              defaultValue={plan.max_qr_static ?? ""}
              hint="Vuoto = illimitati"
            />
            <Input
              label="QR dinamici"
              name="max_dynamic_qr"
              type="number"
              min={0}
              defaultValue={plan.max_dynamic_qr ?? ""}
              hint="Vuoto = illimitati"
            />
            <Input
              label="Aziende"
              name="max_companies"
              type="number"
              min={0}
              defaultValue={plan.max_companies ?? ""}
              hint="Vuoto = illimitate"
            />
          </div>
          <PlanFeaturesFields features={plan.features} />
        </fieldset>
        {canWrite && (
          <Button type="submit" variant="secondary" loading={busy}>
            Salva {plan.name}
          </Button>
        )}
      </form>
    </Card>
  );
}
