"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { useCompany } from "@/lib/company-context";
import { useDebouncedValue } from "@/lib/hooks";
import type { SearchHit } from "@/lib/types";
import styles from "./organize.module.css";

/** Topbar search: name, slug, back-half, destination URL and tag. ⌘K / Ctrl+K opens it. */
export function SearchDialog() {
  const { company } = useCompany();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [all, setAll] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const q = useDebouncedValue(term.trim());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !q) return;
    let alive = true;
    const params = new URLSearchParams({ q, company_id: String(company.id) });
    if (all) params.set("all_companies", "true");
    api<SearchHit[]>(`search?${params}`)
      .then((r) => alive && setHits(r))
      .catch(() => alive && setHits([]));
    return () => {
      alive = false;
    };
  }, [open, q, all, company.id]);

  const shown = q ? hits : null;
  return (
    <>
      <button type="button" className={styles.searchTrigger} onClick={() => setOpen(true)}>
        <Search size={14} aria-hidden="true" />
        <span>Cerca</span>
        <kbd aria-hidden="true">⌘K</kbd>
      </button>
      <Modal open={open} title="Cerca link e QR" onClose={() => setOpen(false)}>
        <div className="stack">
          <label className="visually-hidden" htmlFor="global-search">
            Cerca per nome, link, back-half, URL o tag
          </label>
          <input
            id="global-search"
            type="search"
            autoFocus
            placeholder="Nome, link, back-half, URL o tag"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            style={{
              font: "inherit",
              padding: "var(--space-3)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
            }}
          />
          <label style={{ fontSize: "var(--fs-sm)" }}>
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Cerca
            in tutte le aziende
          </label>
          <ul className={styles.results} aria-live="polite">
            {shown?.map((hit) => (
              <li key={`${hit.company_id}-${hit.id}`}>
                <Link href={`/app/c/${hit.company_id}/qr/${hit.id}`} onClick={() => setOpen(false)}>
                  <strong>{hit.name}</strong>
                  <small>
                    {all || hit.company_id !== company.id ? `${hit.company} · ` : ""}
                    {hit.slug ? `/${hit.slug} · ` : ""}
                    {hit.target_url || hit.qr_type}
                  </small>
                </Link>
              </li>
            ))}
            {shown && shown.length === 0 && <li className="muted">Nessun risultato.</li>}
          </ul>
        </div>
      </Modal>
    </>
  );
}
