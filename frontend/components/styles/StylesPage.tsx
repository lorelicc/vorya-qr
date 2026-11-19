"use client";
import { Palette, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, EmptyState, IconButton, SkeletonList, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import type { StylePresetItem } from "@/lib/types";
import styles from "./StylesPage.module.css";

function PresetThumb({ preset }: { preset: StylePresetItem }) {
  const { api: base } = useCompany();
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    api<{ svg: string }>(`${base}/qr-codes/preview`, "POST", {
      qr_type: "website",
      dynamic: false,
      static_data: { url: "https://qr.vorya.it" },
      design: preset.design,
    })
      .then((r) => setSvg(r.svg))
      .catch(() => setSvg(null));
  }, [base, preset]);
  return svg ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" />
  ) : (
    <span className={styles.placeholder} />
  );
}

/** Saved QR styles of the company (created from the QR designer). */
export function StylesPage() {
  const { api: base } = useCompany();
  const toast = useToast();
  const [presets, setPresets] = useState<StylePresetItem[] | null>(null);

  useEffect(() => {
    api<StylePresetItem[]>(`${base}/styles`)
      .then(setPresets)
      .catch((err) => toast.show(errorMessage(err), "error"));
  }, [base, toast]);

  async function remove(preset: StylePresetItem) {
    try {
      await api(`${base}/styles/${preset.id}`, "DELETE");
      setPresets((all) => all?.filter((p) => p.id !== preset.id) ?? null);
      toast.show("Stile eliminato.");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Stili</h1>
          <p>
            Gli stili salvati dal designer dei QR, pronti da applicare ad altri codici dell’azienda.
          </p>
        </div>
      </div>
      {presets === null ? (
        <SkeletonList rows={2} />
      ) : presets.length === 0 ? (
        <EmptyState
          icon={<Palette size={26} />}
          title="Nessuno stile salvato"
          description="Nel designer di un QR usa “Salva stile” per riutilizzare forme, colori e logo."
        />
      ) : (
        <div className={styles.grid}>
          {presets.map((preset) => (
            <Card
              key={preset.id}
              title={preset.name}
              actions={
                <IconButton
                  label={`Elimina ${preset.name}`}
                  tone="danger"
                  onClick={() => remove(preset)}
                >
                  <Trash2 size={16} />
                </IconButton>
              }
            >
              <div className={styles.thumb}>
                <PresetThumb preset={preset} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
