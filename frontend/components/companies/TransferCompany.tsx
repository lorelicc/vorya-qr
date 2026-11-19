"use client";
import { useState, type FormEvent } from "react";
import { Button, Card, Input, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCompany } from "@/lib/company-context";

export function TransferCompany() {
  const { company } = useCompany();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`companies/${company.id}/transfer`, "POST", { email });
      toast.show("Richiesta inviata: il destinatario riceverà un’email.");
      setEmail("");
    } catch (err) {
      toast.show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Trasferisci a un altro account"
      description="Indica l’email di un account Vorya QR verificato. Il destinatario potrà accettare o rifiutare entro 7 giorni; puoi annullare dalla pagina Aziende finché è in attesa. Dopo l’accettazione perderai subito l’accesso; i QR continueranno a funzionare."
    >
      <form className="stack" onSubmit={submit} noValidate>
        <Input
          label="Email del destinatario"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
        />
        <div>
          <Button type="submit" variant="secondary" loading={busy} disabled={!email}>
            Invia richiesta
          </Button>
        </div>
      </form>
    </Card>
  );
}
