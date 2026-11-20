"use client";
import { useEffect, useState } from "react";

/** A public number, shown only when the server says it is real and above the admin threshold. */
export function Counter({ label }: { label: string }) {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/public/site/counters")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d) => setValue(d?.qr_created ?? null),
        () => setValue(null),
      );
  }, []);
  if (value === null) return null;
  return (
    <p style={{ textAlign: "center", fontSize: "var(--fs-lg)", margin: 0 }}>
      <strong>{new Intl.NumberFormat("it-IT").format(value)}</strong> {label}
    </p>
  );
}
