"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Onboarding } from "@/components/illustrations";
import { Button, ButtonLink, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { designForCompany } from "@/lib/design";
import type { QrCode } from "@/lib/types";
import { blockId, defaultPage } from "./pages/defaults";
import styles from "./OnboardingPanel.module.css";

const STEPS = [
  ["Scegli il tipo", "Sito web, vCard, PDF, menu, link in bio e altri."],
  ["Personalizza", "Contenuto, colori, forme e logo con anteprima dal vivo."],
  ["Stampa e misura", "Scarica in PNG, SVG o PDF e segui le scansioni."],
] as const;

/** First access: explains the flow and offers a ready-made sample QR (a link-in-bio page). */
export function OnboardingPanel({ canCreate }: { canCreate: boolean }) {
  const { company, api: base, app } = useCompany();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function sample() {
    setBusy(true);
    const page = defaultPage("link_in_bio", company);
    page.blocks = [
      page.blocks[0],
      {
        id: blockId("t"),
        type: "text",
        markdown:
          "**Questo è un QR di esempio.** Modifica testi e link: chi l’ha già scansionato vedrà subito la nuova versione.",
      },
      { id: blockId("l"), type: "link_list", items: [] },
    ];
    try {
      const qr = await api<QrCode>(`${base}/qr-codes`, "POST", {
        name: "QR di esempio",
        qr_type: "link_in_bio",
        dynamic: true,
        page,
        design: designForCompany(company),
      });
      router.push(`${app}/qr/${qr.id}?created=1`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="onboarding-title">
      <div className={styles.art}>
        <Onboarding size={280} />
      </div>
      <div className={styles.body}>
        <h2 id="onboarding-title">Benvenuto in Vorya QR</h2>
        <p className={styles.lead}>
          Crea codici QR con il marchio di {company.name}: quelli dinamici si possono modificare
          anche dopo la stampa.
        </p>
        <ol className={styles.steps}>
          {STEPS.map(([title, text], index) => (
            <li key={title} style={{ animationDelay: `${index * 80}ms` }}>
              <span aria-hidden="true">{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <small>{text}</small>
              </div>
            </li>
          ))}
        </ol>
        {canCreate && (
          <div className={styles.actions}>
            <ButtonLink href={`${app}/qr/new`}>Crea il tuo primo QR</ButtonLink>
            <Button variant="secondary" loading={busy} onClick={sample}>
              Prova con un QR di esempio
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
