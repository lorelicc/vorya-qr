"use client";
import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Table,
  useToast,
  type Column,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { BlockedDomain } from "@/lib/types";
import styles from "./admin.module.css";

export function BlockedDomains({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<BlockedDomain[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<BlockedDomain[]>("admin/blocked-domains")
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const added = await api<BlockedDomain>("admin/blocked-domains", "POST", {
        domain: data.get("domain"),
        reason: data.get("reason"),
      });
      setRows((all) => [...(all ?? []), added].sort((a, b) => a.domain.localeCompare(b.domain)));
      form.reset();
      toast.show(`${added.domain} bloccato.`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(domain: BlockedDomain) {
    try {
      await api(`admin/blocked-domains/${domain.id}`, "DELETE");
      setRows((all) => all?.filter((d) => d.id !== domain.id) ?? null);
      toast.show(`${domain.domain} rimosso.`);
    } catch (err) {
      toast.show(errorMessage(err), "error");
    }
  }

  const columns: Column<BlockedDomain>[] = [
    {
      key: "domain",
      header: "Dominio",
      mobileLabel: false,
      render: (d) => <code>{d.domain}</code>,
    },
    { key: "reason", header: "Motivo", render: (d) => d.reason || "—" },
    { key: "date", header: "Aggiunto", align: "end", render: (d) => formatDate(d.created_at) },
    ...(canWrite
      ? [
          {
            key: "remove",
            header: "",
            align: "end" as const,
            mobileLabel: false,
            render: (d: BlockedDomain) => (
              <IconButton label={`Rimuovi ${d.domain}`} onClick={() => remove(d)}>
                <Trash2 size={16} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Domini bloccati</h1>
          <p>
            Destinazioni rifiutate alla creazione e alla modifica dei QR (dominio e tutti i
            sottodomini). I QR già esistenti non cambiano: usa le segnalazioni per bloccarli.
          </p>
        </div>
      </div>
      {canWrite && (
        <Card title="Blocca un dominio">
          <form className={styles.domainForm} onSubmit={add}>
            <Input
              label="Dominio"
              name="domain"
              placeholder="esempio.com"
              required
              maxLength={300}
            />
            <Input label="Motivo (facoltativo)" name="reason" maxLength={200} />
            <Button type="submit" loading={busy}>
              Blocca
            </Button>
          </form>
        </Card>
      )}
      {error && <p role="alert">{error}</p>}
      {rows === null ? (
        <p className="muted">Caricamento…</p>
      ) : (
        <Table
          caption="Domini bloccati"
          columns={columns}
          rows={rows}
          rowKey={(d) => d.id}
          empty={<EmptyState title="Nessun dominio bloccato" description="L’elenco è vuoto." />}
        />
      )}
    </div>
  );
}
