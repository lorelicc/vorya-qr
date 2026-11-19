import type { BadgeTone } from "@/components/ui";
import type { Access } from "@/lib/types";

export const ACCESS: Record<Access, { label: string; tone: BadgeTone }> = {
  active: { label: "Attivo", tone: "success" },
  trial: { label: "In prova", tone: "info" },
  trial_expired: { label: "Prova scaduta", tone: "warning" },
  suspended: { label: "Sospeso", tone: "danger" },
  past_due: { label: "Pagamento in ritardo", tone: "warning" },
  payment_blocked: { label: "Abbonamento non attivo", tone: "danger" },
};
