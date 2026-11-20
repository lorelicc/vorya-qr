"use client";
import { useEffect, useState } from "react";
import { Card, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

/** Owner's switch for the activation emails (welcome, quick guide, pages). Billing mails stay. */
export function MailPreferences() {
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ onboarding: boolean }>("account/mail-preferences")
      .then((r) => setOn(r.onboarding))
      .catch(() => setOn(null));
  }, []);
  if (on === null) return null;
  return (
    <Card
      title="Email di aiuto"
      description="Benvenuto, guida rapida e idee per iniziare. Le email su pagamenti e account restano sempre attive."
    >
      <label style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={on}
          onChange={async (e) => {
            const value = e.target.checked;
            try {
              await api("account/mail-preferences", "PUT", { onboarding: value });
              setOn(value);
            } catch (err) {
              toast.show(errorMessage(err), "error");
            }
          }}
        />
        Ricevi le email di aiuto per iniziare
      </label>
    </Card>
  );
}
