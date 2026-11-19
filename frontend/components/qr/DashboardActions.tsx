"use client";
import { FileDown, MoreHorizontal, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { ButtonLink, Menu, MenuItem } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import styles from "./Dashboard.module.css";

/** One clear primary action; CSV import/export are occasional and live in a quiet menu. */
export function DashboardActions({
  canCreate,
  showMore,
  exportHref,
}: {
  canCreate: boolean;
  showMore: boolean;
  exportHref: string;
}) {
  const { app } = useCompany();
  const router = useRouter();
  return (
    <div className={styles.headerActions}>
      {canCreate && (
        <ButtonLink href={`${app}/qr/new`} className={styles.cta} icon={<Plus size={18} />}>
          Crea QR Code
        </ButtonLink>
      )}
      {showMore && (
        <Menu
          label="Altre azioni"
          trigger={(props) => (
            <button type="button" className={styles.more} {...props}>
              <MoreHorizontal size={18} aria-hidden="true" />
              <span className="visually-hidden">Altre azioni</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onSelect={() => {
                  close();
                  router.push(`${app}/import`);
                }}
              >
                <Upload size={14} aria-hidden="true" /> Importa da CSV
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  close();
                  const link = Object.assign(document.createElement("a"), {
                    href: exportHref,
                    download: "",
                  });
                  link.click();
                }}
              >
                <FileDown size={14} aria-hidden="true" /> Esporta in CSV
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </div>
  );
}
