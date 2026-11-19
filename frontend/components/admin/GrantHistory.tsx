"use client";
import { Badge, Button } from "@/components/ui";
import type { Grant } from "@/lib/admin-clients";
import { formatDate } from "@/lib/format";
import styles from "./admin.module.css";

/** Every gift given to the customer, newest first; a running one can be revoked. */
export function GrantHistory({
  grants,
  canWrite,
  onRevoke,
}: {
  grants: Grant[];
  canWrite: boolean;
  onRevoke: (id: number) => void;
}) {
  if (grants.length === 0) return null;
  return (
    <ul className={styles.facts} style={{ listStyle: "none", padding: 0 }}>
      {grants.map((g) => (
        <li key={g.id} style={{ display: "contents" }}>
          <dt>{formatDate(g.created_at)}</dt>
          <dd>
            {g.months} {g.months === 1 ? "mese" : "mesi"} di {g.plan_id.toUpperCase()}
            {g.note && ` · ${g.note}`}{" "}
            {g.revoked_at ? (
              <Badge tone="neutral">Revocato</Badge>
            ) : new Date(g.ends_at) > new Date() ? (
              <>
                <Badge tone="success">Attivo</Badge>{" "}
                {canWrite && (
                  <Button variant="ghost" onClick={() => onRevoke(g.id)}>
                    Revoca
                  </Button>
                )}
              </>
            ) : (
              <Badge tone="neutral">Concluso</Badge>
            )}
          </dd>
        </li>
      ))}
    </ul>
  );
}
