"use client";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, IconButton, Input, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";

type Recipient = { id: number; email: string; status: "pending" | "active" | "unsubscribed" };
type Reports = {
  frequencies_allowed: ("weekly" | "monthly")[];
  max_recipients: number;
  weekly: boolean;
  monthly: boolean;
  recipients: Recipient[];
};
const STATUS = {
  pending: { label: "In attesa di conferma", tone: "warning" },
  active: { label: "Attivo", tone: "success" },
  unsubscribed: { label: "Disiscritto", tone: "neutral" },
} as const;

/** Weekly / monthly email reports for the customers of this company (double opt-in). */
export function ReportsCard() {
  const { company } = useCompany();
  const toast = useToast();
  const base = `companies/${company.id}/reports`;
  const [data, setData] = useState<Reports | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Reports>(base)
      .then(setData)
      .catch((err) => toast.show(errorMessage(err), "error"));
  }, [base, toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function run<T>(action: () => Promise<T>, ok: string, apply: (r: T) => void) {
    setBusy(true);
    try {
      apply(await action());
      toast.show(ok);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const locked = data.frequencies_allowed.length === 0;
  const setFlag = (flag: "weekly" | "monthly", value: boolean) =>
    run(
      () =>
        api<Reports>(base, "PUT", { weekly: data.weekly, monthly: data.monthly, [flag]: value }),
      "Impostazioni salvate.",
      setData,
    );

  return (
    <Card
      title="Report via email"
      description="Scansioni, clic, codici più scansionati, paesi e dispositivi: ogni settimana o ogni mese ai tuoi clienti."
    >
      {locked ? (
        <p>
          I report via email sono inclusi nei piani Start e superiori.{" "}
          <a href="/account/plan">Vedi i piani</a>
        </p>
      ) : (
        <div className="stack">
          <div className="row">
            {(["weekly", "monthly"] as const).map((flag) => (
              <label key={flag} style={{ display: "inline-flex", gap: "var(--space-2)" }}>
                <input
                  type="checkbox"
                  checked={data[flag]}
                  disabled={busy || !data.frequencies_allowed.includes(flag)}
                  onChange={(e) => setFlag(flag, e.target.checked)}
                />
                {flag === "weekly" ? "Settimanale (ogni lunedì)" : "Mensile (il primo del mese)"}
              </label>
            ))}
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "var(--space-2)",
            }}
          >
            {data.recipients.map((r) => (
              <li key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  {r.email} <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </span>
                <IconButton
                  label={`Rimuovi ${r.email}`}
                  onClick={() =>
                    run(
                      () => api<Reports>(`${base}/recipients/${r.id}`, "DELETE"),
                      "Destinatario rimosso.",
                      setData,
                    )
                  }
                >
                  <Trash2 size={16} />
                </IconButton>
              </li>
            ))}
          </ul>
          <form
            className="row"
            style={{ alignItems: "end" }}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              run(
                () => api<Reports>(`${base}/recipients`, "POST", { email }),
                "Email di conferma inviata al destinatario.",
                (r) => {
                  setData(r);
                  setEmail("");
                },
              );
            }}
          >
            <Input
              label={`Aggiungi un destinatario (${data.recipients.filter((r) => r.status !== "unsubscribed").length}/${data.max_recipients})`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@esempio.it"
              hint="Riceverà un’email per confermare: senza conferma non gli scriviamo."
            />
            <Button type="submit" loading={busy} disabled={!email}>
              Aggiungi
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
