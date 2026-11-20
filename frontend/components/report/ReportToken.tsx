"use client";
import { useEffect, useState } from "react";
import { Notice } from "@/components/auth/Notice";
import { PublicApiError, publicPost } from "@/lib/site/public-api";

/** Confirm / unsubscribe from a report: the token lives in the URL fragment (never in logs). */
export function ReportToken({ action }: { action: "confirm" | "unsubscribe" }) {
  const [state, setState] = useState<"working" | "done" | string>("working");
  const [company, setCompany] = useState("");
  useEffect(() => {
    const token = window.location.hash.slice(1);
    publicPost<{ company?: string }>(`public/report-subscriptions/${action}`, { token })
      .then((r) => {
        setCompany(r.company ?? "");
        setState("done");
      })
      .catch((err) => setState(err instanceof PublicApiError ? err.message : "Link non valido."));
  }, [action]);
  if (state === "working") return <p role="status">Un istante…</p>;
  if (state !== "done") return <Notice tone="error">{state}</Notice>;
  return (
    <Notice tone="success">
      {action === "confirm"
        ? `Fatto! Da ora riceverai i report${company ? ` di «${company}»` : ""}. In ogni email trovi il link per disiscriverti.`
        : "Non riceverai più questi report. Se è stato un errore, chiedi a chi te li inviava di aggiungerti di nuovo."}
    </Notice>
  );
}
