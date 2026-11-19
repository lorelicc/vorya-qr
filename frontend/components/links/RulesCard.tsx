"use client";
import { CalendarClock, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { api, errorMessage, fieldErrors, type FieldErrors } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { formatDateTime } from "@/lib/format";
import type { AccountPlan, QrCode } from "@/lib/types";
import { RulesTimeline } from "./RulesTimeline";
import styles from "./links.module.css";

export type Rules = {
  expires_at: string | null;
  max_scans: number | null;
  fallback_url: string | null;
  has_password: boolean;
  schedule: { starts_at: string; url: string }[];
};

// <input type="datetime-local"> works in local time: convert to and from ISO.
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

/** Expiry (date or scans), password and scheduled destinations. */
export function RulesCard({ qr, plan }: { qr: QrCode; plan: AccountPlan | null }) {
  const { api: base } = useCompany();
  const toast = useToast();
  const [rules, setRules] = useState<Rules | null>(null);
  const [form, setForm] = useState({ expires: "", maxScans: "", fallback: "", password: "" });
  const [schedule, setSchedule] = useState<{ starts: string; url: string }[]>([]);
  const [removePassword, setRemovePassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const allowed = plan?.features.link_rules ?? true;

  useEffect(() => {
    api<Rules>(`${base}/qr-codes/${qr.id}/rules`)
      .then((r) => {
        setRules(r);
        setForm({
          expires: toLocal(r.expires_at),
          maxScans: r.max_scans ? String(r.max_scans) : "",
          fallback: r.fallback_url ?? "",
          password: "",
        });
        setSchedule(r.schedule.map((e) => ({ starts: toLocal(e.starts_at), url: e.url })));
      })
      .catch(() => undefined);
  }, [base, qr.id]);

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      const body: Record<string, unknown> = {
        expires_at: toIso(form.expires),
        max_scans: form.maxScans ? Number(form.maxScans) : null,
        fallback_url: form.fallback.trim() || null,
        schedule: schedule
          .filter((e) => e.starts && e.url.trim())
          .map((e) => ({ starts_at: toIso(e.starts), url: e.url.trim() })),
      };
      if (removePassword) body.password = "";
      else if (form.password) body.password = form.password;
      const saved = await api<Rules>(`${base}/qr-codes/${qr.id}/rules`, "PUT", body);
      setRules(saved);
      setForm((f) => ({ ...f, password: "" }));
      setRemovePassword(false);
      toast.show("Regole salvate.");
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed)
    return (
      <Card title="Regole del link">
        <p className={styles.locked}>
          <Lock size={14} aria-hidden="true" /> Scadenza, password e programmazione: disponibile nel
          piano Pro.
        </p>
      </Card>
    );
  if (!rules) return null;

  return (
    <Card
      title="Regole del link"
      description="Valgono per il link breve e per il QR: si applicano alla prossima scansione."
    >
      <div className="stack">
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span>Scade il</span>
            <input
              type="datetime-local"
              value={form.expires}
              onChange={(e) => setForm({ ...form, expires: e.target.value })}
            />
          </label>
          <Input
            label="Oppure dopo N scansioni"
            type="number"
            min={1}
            value={form.maxScans}
            onChange={(e) => setForm({ ...form, maxScans: e.target.value })}
            hint="Vuoto = nessun limite."
          />
        </div>
        <Input
          label="URL di riserva alla scadenza (facoltativo)"
          type="url"
          value={form.fallback}
          onChange={(e) => setForm({ ...form, fallback: e.target.value })}
          error={errors.fallback_url}
          hint="Senza, chi scansiona vede la pagina «Link scaduto»."
        />
        <div>
          <Input
            label={
              rules.has_password ? "Nuova password (lascia vuoto per non cambiarla)" : "Password"
            }
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            hint="Chi apre il link deve inserirla; resta valida 24 ore su quel dispositivo."
            disabled={removePassword}
          />
          {rules.has_password && (
            <label className={styles.inline}>
              <input
                type="checkbox"
                checked={removePassword}
                onChange={(e) => setRemovePassword(e.target.checked)}
              />{" "}
              Rimuovi la password
            </label>
          )}
        </div>

        <fieldset className={styles.schedule}>
          <legend>
            <CalendarClock size={16} aria-hidden="true" /> Destinazione programmata
          </legend>
          <p className="muted">
            Dal giorno e dall’ora indicati il link porta a un altro indirizzo. Si valuta a ogni
            scansione, senza altro da fare.
          </p>
          {schedule.map((entry, i) => (
            <div key={i} className={styles.scheduleRow}>
              <input
                type="datetime-local"
                aria-label={`Data e ora della regola ${i + 1}`}
                value={entry.starts}
                onChange={(e) =>
                  setSchedule((all) =>
                    all.map((x, j) => (j === i ? { ...x, starts: e.target.value } : x)),
                  )
                }
              />
              <input
                type="url"
                aria-label={`URL della regola ${i + 1}`}
                placeholder="https://"
                value={entry.url}
                onChange={(e) =>
                  setSchedule((all) =>
                    all.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  )
                }
              />
              <button
                type="button"
                aria-label={`Rimuovi la regola ${i + 1}`}
                onClick={() => setSchedule((all) => all.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {errors.rules && <p role="alert">{errors.rules}</p>}
          <Button
            variant="ghost"
            icon={<Plus size={16} />}
            onClick={() => setSchedule((all) => [...all, { starts: "", url: "" }])}
            disabled={schedule.length >= 20}
          >
            Aggiungi regola
          </Button>
          <RulesTimeline
            now={now}
            base={qr.target_url}
            entries={schedule
              .filter((e) => e.starts && e.url)
              .map((e) => ({ at: new Date(e.starts), url: e.url }))}
            expires={form.expires ? new Date(form.expires) : null}
          />
        </fieldset>

        <div>
          <Button loading={busy} onClick={save}>
            Salva regole
          </Button>
          {rules.expires_at && (
            <span className="muted" style={{ marginLeft: "var(--space-3)" }}>
              Scadenza attuale: {formatDateTime(rules.expires_at)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
