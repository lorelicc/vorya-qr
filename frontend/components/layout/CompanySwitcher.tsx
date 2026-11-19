"use client";
import { Building2, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, MenuItem } from "@/components/ui";
import { api } from "@/lib/api";
import type { Company } from "@/lib/types";
import { CompanyAvatar } from "./CompanyAvatar";
import styles from "./CompanySwitcher.module.css";

/** Sidebar company picker (as in Vorya Sign): switches the current company and remembers it. */
export function CompanySwitcher({
  current,
}: {
  current: Pick<Company, "id" | "name" | "logo_url" | "primary_color">;
}) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    api<Company[]>("companies")
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  async function open(id: number) {
    await api("account/last-company", "PUT", { company_id: id }).catch(() => undefined);
    router.push(`/app/c/${id}`);
  }

  return (
    <Menu
      label="Cambia azienda"
      align="start"
      className={styles.switcher}
      trigger={(props) => (
        <button type="button" className={styles.trigger} {...props}>
          <CompanyAvatar company={current} size={32} />
          <span className={styles.label}>
            <small>Azienda</small>
            <strong>{current.name}</strong>
          </span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <>
          {companies.map((company) => (
            <MenuItem
              key={company.id}
              active={company.id === current.id}
              onSelect={() => {
                close();
                if (company.id !== current.id) open(company.id);
              }}
            >
              <CompanyAvatar company={company} size={24} />
              <span className={styles.itemName}>{company.name}</span>
            </MenuItem>
          ))}
          <div className={styles.separator} />
          <MenuItem onSelect={() => router.push("/companies")}>
            <Building2 size={16} /> Tutte le aziende
          </MenuItem>
          <MenuItem onSelect={() => router.push("/companies?new=1")}>
            <Plus size={16} /> Crea azienda
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
