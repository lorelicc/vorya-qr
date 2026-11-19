"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Card, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { useReducedMotion } from "@/lib/motion";
import type { AccountPlan, QrCode, Scannability } from "@/lib/types";
import { ContentFields } from "../ContentFields";
import { DesignPanel } from "../design/DesignPanel";
import { DownloadPanel } from "../DownloadPanel";
import { ThemeFields } from "../pages/shared";
import { PhonePreview } from "../PhonePreview";
import { QrPreview } from "../QrPreview";
import { TYPE_BY_KEY, isPageType } from "../types/meta";
import { TypePicker } from "../types/TypePicker";
import { useQrDraft } from "../useQrDraft";
import { Celebration } from "./Celebration";
import { STEPS, Stepper } from "./Stepper";
import styles from "./wizard.module.css";

const CONTENT_FIELDS = ["name", "target_url", "static_data", "page", "destination"];

/** New QR in four steps: type, content, design, save & download. */
export function QrWizard() {
  const router = useRouter();
  const toast = useToast();
  const reduced = useReducedMotion();
  const { api: base, app, company } = useCompany();
  const q = useQrDraft(company);
  const { draft, update } = q;
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<Scannability | null>(null);
  const [created, setCreated] = useState<QrCode | null>(null);
  const onScannability = useCallback((result: Scannability | null) => setScan(result), []);
  const type = draft.qr_type;
  const page = type && isPageType(type) ? draft.page : null;

  useEffect(() => {
    api<AccountPlan>("account/plan")
      .then(setPlan)
      .catch(() => undefined);
  }, []);

  function go(next: number) {
    if (next === step) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  function nextFromContent() {
    if (!draft.name.trim()) {
      setErrors({ name: "Dai un nome al QR per ritrovarlo." });
      return;
    }
    setErrors({});
    go(2);
  }

  async function create() {
    setBusy(true);
    setErrors({});
    try {
      const saved = await api<QrCode>(`${base}/qr-codes`, "POST", q.createPayload());
      setCreated(saved);
      router.refresh();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      toast.show(errorMessage(err), "error");
      if (Object.keys(fields).some((f) => CONTENT_FIELDS.includes(f))) go(1);
      else if (fields.design) go(2);
    } finally {
      setBusy(false);
    }
  }

  const canNext =
    step === 0 ? Boolean(type) : step === 2 ? !(scan !== null && !scan.scannable) : true;
  const offset = reduced ? 0 : 48;

  const preview =
    step === 1 && page ? (
      <PhonePreview page={page} files={q.files} />
    ) : (
      <QrPreview
        payload={q.previewPayload}
        dynamic={q.kind === "dynamic"}
        onScannability={onScannability}
      />
    );

  if (created) {
    return (
      <div className={styles.done}>
        <Celebration />
        <h2>«{created.name}» è pronto</h2>
        <p className="muted">
          {created.kind === "dynamic"
            ? "Puoi cambiarne il contenuto quando vuoi: il QR stampato resta lo stesso."
            : "Il contenuto è scritto nel QR: per cambiarlo serve un nuovo QR."}
        </p>
        <DownloadPanel qrId={created.id} />
        <div className={styles.doneActions}>
          <ButtonLink href={`${app}/qr/${created.id}`}>Apri il QR</ButtonLink>
          <Button variant="secondary" onClick={() => router.push(app)}>
            Torna ai QR
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizard}>
      <Stepper step={step} onJump={go} maxReached={maxReached} />
      <div className={styles.stage}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={step}
            className={styles.panel}
            aria-labelledby="wizard-step-title"
            custom={direction}
            initial={{ opacity: 0, x: direction * offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -offset }}
            transition={{ duration: reduced ? 0.06 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h2 id="wizard-step-title" className="visually-hidden">
              {STEPS[step]}
            </h2>
            {step === 0 && (
              <TypePicker
                value={type}
                allowed={plan?.features.allowed_types ?? []}
                onChange={(t) => {
                  q.chooseType(t);
                  setMaxReached(1);
                }}
              />
            )}
            {step > 0 && (
              <div className={styles.split}>
                <div className="stack">
                  {step === 1 && (
                    <>
                      <Card title={`Contenuto · ${type ? TYPE_BY_KEY[type].label : ""}`}>
                        <ContentFields q={q} editing={false} errors={errors} />
                      </Card>
                      {page && (
                        <Card title="Aspetto della pagina">
                          <ThemeFields
                            page={page}
                            onChange={(p) => update({ page: p })}
                            files={q.files}
                            addFile={q.addFile}
                            canRemoveBranding={Boolean(plan?.features.remove_branding)}
                          />
                        </Card>
                      )}
                    </>
                  )}
                  {step === 2 && (
                    <Card title="Aspetto del QR">
                      <DesignPanel
                        value={draft.design}
                        onChange={(design) => update({ design })}
                        files={q.files}
                        addFile={q.addFile}
                      />
                    </Card>
                  )}
                  {step === 3 && (
                    <Card title="Riepilogo">
                      <dl className={styles.summary}>
                        <dt>Nome</dt>
                        <dd>{draft.name}</dd>
                        <dt>Tipo</dt>
                        <dd>
                          {type ? TYPE_BY_KEY[type].label : ""} ·{" "}
                          {q.kind === "dynamic" ? "dinamico" : "statico"}
                        </dd>
                        {type === "website" && q.kind === "dynamic" && (
                          <>
                            <dt>Destinazione</dt>
                            <dd className={styles.url}>{draft.target_url}</dd>
                          </>
                        )}
                      </dl>
                      <p className="muted">
                        Dopo il salvataggio potrai scaricarlo in PNG, SVG o PDF.
                        {q.kind === "dynamic" &&
                          " Il link breve viene creato ora e non cambia più."}
                      </p>
                    </Card>
                  )}
                </div>
                <aside className={styles.side}>
                  <Card title={step === 1 && page ? "Anteprima della pagina" : "Anteprima"}>
                    {preview}
                  </Card>
                </aside>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
      <div className={styles.nav}>
        {step > 0 ? (
          <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => go(step - 1)}>
            Indietro
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button
            icon={<ArrowRight size={16} />}
            disabled={!canNext}
            onClick={() => (step === 1 ? nextFromContent() : go(step + 1))}
          >
            Avanti
          </Button>
        ) : (
          <Button loading={busy} onClick={create} disabled={scan !== null && !scan.scannable}>
            Crea codice QR
          </Button>
        )}
      </div>
    </div>
  );
}
