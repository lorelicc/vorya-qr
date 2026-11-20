"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Input, Select, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { yearlySaving, type PublicPlans } from "@/lib/billing";

type Offer = {
  featured_plan: string | null;
  featured_label: string;
  yearly_discount_pct: number;
  yearly_label: string;
  trial_days: number;
  trial_plan_id: string;
  banner: {
    enabled: boolean;
    text: string;
    cta: string;
    href: string;
    tone: "green" | "indigo" | "sun" | "coral";
  };
};
type Data = { offer: Offer; plans: { id: string; name: string }[] };

const TONES = [
  ["green", "Verde"],
  ["indigo", "Viola"],
  ["sun", "Giallo"],
  ["coral", "Corallo"],
] as const;

/** Admin: what the public site shows (highlighted plan, yearly switch, promo strip, trial). */
export function SiteOfferAdmin({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Offer | null>(null);
  const [real, setReal] = useState<{ name: string; saving: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Data>("admin/site-offer"),
      fetch("/api/public/plans").then((r) => (r.ok ? (r.json() as Promise<PublicPlans>) : null)),
    ])
      .then(([d, plans]) => {
        setData(d);
        setForm(d.offer);
        setReal(
          (plans?.plans ?? [])
            .map((p) => ({ name: p.name, saving: yearlySaving(p.prices) }))
            .filter((p) => p.saving > 0),
        );
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!data || !form) return <p className="muted">Caricamento…</p>;

  const set = (patch: Partial<Offer>) => setForm({ ...form, ...patch });
  const setBanner = (patch: Partial<Offer["banner"]>) =>
    setForm({ ...form, banner: { ...form.banner, ...patch } });

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const saved = await api<Data>("admin/site-offer", "PUT", form);
      setData(saved);
      setForm(saved.offer);
      toast.show("Impostazioni del sito salvate. La striscia si aggiorna entro un minuto.");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const planName = data.plans.find((p) => p.id === form.trial_plan_id)?.name ?? form.trial_plan_id;
  const preview = form.banner.text
    .replaceAll("{plan}", planName)
    .replaceAll("{days}", String(form.trial_days));
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sito</h1>
          <p>Offerta mostrata nelle pagine pubbliche: prezzi, prova gratuita e striscia in alto.</p>
        </div>
      </div>
      <form onSubmit={save} style={{ display: "grid", gap: "var(--space-5)" }}>
        <Card title="Pagina prezzi" description="Gli importi restano quelli collegati a Stripe.">
          <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 520 }}>
            <Select
              label="Piano in evidenza"
              value={form.featured_plan ?? ""}
              onChange={(e) => set({ featured_plan: e.target.value || null })}
              disabled={!canWrite}
            >
              <option value="">Nessuno</option>
              {data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Input
              label="Etichetta del piano in evidenza"
              value={form.featured_label}
              maxLength={30}
              onChange={(e) => set({ featured_label: e.target.value })}
              disabled={!canWrite}
            />
            <Input
              label="Sconto annuale mostrato (%)"
              type="number"
              min={0}
              max={90}
              value={String(form.yearly_discount_pct)}
              onChange={(e) => set({ yearly_discount_pct: Number(e.target.value) })}
              disabled={!canWrite}
              hint={
                real.length
                  ? `Sconto reale dei prezzi collegati: ${real.map((r) => `${r.name} ${r.saving}%`).join(", ")}. Il prezzo annuale lo decidi in Stripe: tieni i due valori coerenti.`
                  : "Nessun prezzo annuale collegato: l’interruttore annuale non compare."
              }
            />
            <Input
              label="Testo accanto all’interruttore (vuoto = «Risparmi il X%»)"
              value={form.yearly_label}
              maxLength={60}
              onChange={(e) => set({ yearly_label: e.target.value })}
              disabled={!canWrite}
            />
          </div>
        </Card>

        <Card
          title="Prova gratuita"
          description="Vale per le nuove registrazioni: la striscia e i pulsanti usano questi valori."
        >
          <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 520 }}>
            <Input
              label="Giorni di prova (0 = nessuna prova)"
              type="number"
              min={0}
              max={90}
              value={String(form.trial_days)}
              onChange={(e) => set({ trial_days: Number(e.target.value) })}
              disabled={!canWrite}
            />
            <Select
              label="Piano provato"
              value={form.trial_plan_id}
              onChange={(e) => set({ trial_plan_id: e.target.value })}
              disabled={!canWrite}
            >
              {data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card
          title="Striscia sopra l’header"
          description="Usa {plan} e {days}: vengono sostituiti con la prova reale, così non prometti nulla di diverso."
        >
          <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 520 }}>
            <label style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.banner.enabled}
                onChange={(e) => setBanner({ enabled: e.target.checked })}
                disabled={!canWrite}
              />
              Mostra la striscia
            </label>
            <Input
              label="Testo"
              value={form.banner.text}
              maxLength={160}
              onChange={(e) => setBanner({ text: e.target.value })}
              disabled={!canWrite}
            />
            <Input
              label="Testo del pulsante"
              value={form.banner.cta}
              maxLength={40}
              onChange={(e) => setBanner({ cta: e.target.value })}
              disabled={!canWrite}
            />
            <Input
              label="Indirizzo del pulsante"
              value={form.banner.href}
              onChange={(e) => setBanner({ href: e.target.value })}
              disabled={!canWrite}
              hint="Un percorso del sito (/register) o un indirizzo https://"
            />
            <Select
              label="Colore"
              value={form.banner.tone}
              onChange={(e) => setBanner({ tone: e.target.value as Offer["banner"]["tone"] })}
              disabled={!canWrite}
            >
              {TONES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <p>
              Anteprima: <strong>{preview}</strong> → {form.banner.cta}
            </p>
          </div>
        </Card>
        {canWrite && (
          <div>
            <Button type="submit">Salva</Button>
          </div>
        )}
      </form>
    </div>
  );
}
