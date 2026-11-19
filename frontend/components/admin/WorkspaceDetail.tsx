"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UsageMeter } from "@/components/qr/UsageMeter";
import { Badge, Button, Card, Modal, Select, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AdminWorkspace, Plan } from "@/lib/types";
import { ACCESS } from "./labels";
import styles from "./admin.module.css";

export function WorkspaceDetail({ id, canWrite }: { id: number; canWrite: boolean }) {
  const toast = useToast();
  const [ws, setWs] = useState<AdminWorkspace | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<AdminWorkspace>(`admin/workspaces/${id}`), api<Plan[]>("admin/plans")])
      .then(([workspace, list]) => {
        setWs(workspace);
        setPlanId(workspace.plan_id);
        setPlans(list);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  async function run(path: string, method: "POST" | "PUT", body?: unknown, message = "Salvato.") {
    setBusy(true);
    try {
      setWs(await api<AdminWorkspace>(`admin/workspaces/${id}/${path}`, method, body));
      toast.show(message);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!ws) return <p className="muted">Caricamento…</p>;
  const suspended = ws.status === "suspended";

  return (
    <div className="page">
      <Link href="/admin/workspaces" className={styles.back}>
        <ArrowLeft size={16} /> Spazi di lavoro
      </Link>
      <div className="page-header">
        <div>
          <h1>{ws.name}</h1>
          <p>
            {ws.owner.display_name} · {ws.owner.email} · creato il {formatDate(ws.created_at)}
          </p>
        </div>
        <Badge tone={ACCESS[ws.access].tone}>{ACCESS[ws.access].label}</Badge>
      </div>
      <div className="grid-2">
        <Card
          title="Piano"
          description={
            ws.trial_ends_at
              ? `Prova fino al ${formatDate(ws.trial_ends_at)}: assegnare un piano termina la prova.`
              : undefined
          }
        >
          <div className="stack">
            <Select
              label="Piano assegnato"
              value={planId}
              disabled={!canWrite}
              onChange={(e) => setPlanId(e.target.value)}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </Select>
            {canWrite && (
              <Button
                loading={busy}
                onClick={() => run("plan", "PUT", { plan_id: planId }, "Piano assegnato.")}
              >
                Assegna piano
              </Button>
            )}
            {ws.usage && (
              <>
                <UsageMeter label="QR dinamici" usage={ws.usage.dynamic} />
                <UsageMeter label="QR statici" usage={ws.usage.static} />
              </>
            )}
          </div>
        </Card>
        <Card
          title="Sospensione"
          description="Un account sospeso non può accedere e i suoi QR dinamici mostrano “QR non attivo”."
        >
          {canWrite ? (
            <Button
              variant={suspended ? "primary" : "danger"}
              onClick={() =>
                suspended
                  ? run("reactivate", "POST", undefined, "Account riattivato.")
                  : setConfirm(true)
              }
              loading={busy}
            >
              {suspended ? "Riattiva account" : "Sospendi account"}
            </Button>
          ) : (
            <p className="muted">Solo un Super Admin può modificare lo stato.</p>
          )}
        </Card>
      </div>
      <Modal
        open={confirm}
        title="Sospendere l’account?"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => run("suspend", "POST", undefined, "Account sospeso.")}
            >
              Sospendi
            </Button>
          </>
        }
      >
        <p>
          Il cliente non potrà accedere e tutti i suoi QR dinamici smetteranno di reindirizzare
          finché non lo riattivi.
        </p>
      </Modal>
    </div>
  );
}
