import { QrCode, ScanLine } from "lucide-react";
import Link from "next/link";
import { CompanyAvatar } from "@/components/layout/CompanyAvatar";
import { formatNumber } from "@/lib/format";
import type { Company } from "@/lib/types";
import styles from "./Companies.module.css";

export function CompanyCard({
  company,
  onOpen,
}: {
  company: Company;
  onOpen: (id: number) => void;
}) {
  return (
    <Link
      href={`/app/c/${company.id}`}
      className={styles.card}
      onClick={() => onOpen(company.id)}
      style={{ ["--company-color" as string]: company.primary_color }}
    >
      <span className={styles.cardBand} aria-hidden="true" />
      <CompanyAvatar company={company} size={56} />
      <strong className={styles.cardName}>{company.name}</strong>
      {company.sector && <span className={styles.cardSector}>{company.sector}</span>}
      <span className={styles.cardStats}>
        <span>
          <QrCode size={14} aria-hidden="true" /> {formatNumber(company.qr_count)} QR
        </span>
        <span>
          <ScanLine size={14} aria-hidden="true" /> {formatNumber(company.scans_7d)} scansioni in 7
          giorni
        </span>
      </span>
    </Link>
  );
}
