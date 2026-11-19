"use client";
import { useState, type ReactNode } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import {
  CYCLE_LABEL,
  formatMoney,
  type BillingInfo,
  type Cycle,
  type PlanCardData,
} from "@/lib/billing";
import { BillingProfileForm } from "./BillingProfileForm";

type Preview = { amount_due_cents: number; currency: string; new_amount_cents: number };
type Choice = { plan: PlanCardData; cycle: Cycle };

/**
 * One entry point for "choose a plan": no subscription -> billing data (if missing) -> Stripe
 * Checkout; with a subscription -> proration preview -> confirm. Returns the dialogs to render.
 */
export function useCheckout(info: BillingInfo | null, reload: () => Promise<void> | void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [needProfile, setNeedProfile] = useState<Choice | null>(null);
  const [change, setChange] = useState<(Choice & { preview: Preview }) | null>(null);

  async function checkout(choice: Choice) {
    setBusy(choice.plan.id);
    try {
      const { url } = await api<{ url: string }>("account/billing/checkout", "POST", {
        plan_id: choice.plan.id,
        cycle: choice.cycle,
      });
      window.location.assign(url);
    } catch (err) {
      toast.show(errorMessage(err), "error");
      setBusy(null);
    }
  }

  async function choose(plan: PlanCardData, cycle: Cycle) {
    if (!info) return;
    const choice = { plan, cycle };
    if (info.has_subscription) {
      setBusy(plan.id);
      try {
        const preview = await api<Preview>("account/billing/change-preview", "POST", {
          plan_id: plan.id,
          cycle,
        });
        setChange({ ...choice, preview });
      } catch (err) {
        toast.show(errorMessage(err), "error");
      } finally {
        setBusy(null);
      }
    } else if (!info.profile) setNeedProfile(choice);
    else await checkout(choice);
  }

  async function confirmChange() {
    if (!change) return;
    setBusy(change.plan.id);
    try {
      await api("account/billing/change", "POST", { plan_id: change.plan.id, cycle: change.cycle });
      toast.show(`Piano ${change.plan.name} attivato.`);
      setChange(null);
      await reload();
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  const dialogs: ReactNode = (
    <>
      <Modal
        open={needProfile !== null}
        title="Dati di fatturazione"
        onClose={() => setNeedProfile(null)}
      >
        <p>Prima di pagare ci servono i dati per la fattura.</p>
        <BillingProfileForm
          initial={info?.profile ?? null}
          submitLabel="Salva e vai al pagamento"
          onSaved={async () => {
            const choice = needProfile;
            setNeedProfile(null);
            await reload();
            if (choice) await checkout(choice);
          }}
        />
      </Modal>
      <Modal
        open={change !== null}
        title="Conferma il cambio di piano"
        onClose={() => setChange(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setChange(null)}>
              Annulla
            </Button>
            <Button loading={busy !== null} onClick={confirmChange}>
              Conferma
            </Button>
          </>
        }
      >
        {change && (
          <>
            <p>
              Passi al piano <strong>{change.plan.name}</strong> (
              {formatMoney(change.preview.new_amount_cents, change.preview.currency)} /{" "}
              {CYCLE_LABEL[change.cycle]}).
            </p>
            <p>
              Stripe calcola il conguaglio sul periodo già pagato. Importo che verrà addebitato ora:{" "}
              <strong>
                {formatMoney(Math.max(0, change.preview.amount_due_cents), change.preview.currency)}
              </strong>
              . I limiti del nuovo piano valgono subito.
            </p>
          </>
        )}
      </Modal>
    </>
  );
  return { choose, busy, dialogs };
}
