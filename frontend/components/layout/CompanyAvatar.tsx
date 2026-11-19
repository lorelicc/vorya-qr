import type { Company } from "@/lib/types";
import styles from "./CompanyAvatar.module.css";

type Props = { company: Pick<Company, "name" | "logo_url" | "primary_color">; size?: number };

export function CompanyAvatar({ company, size = 40 }: Props) {
  const initials = company.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, ["--company-color" as string]: company.primary_color }}
      aria-hidden="true"
    >
      {company.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logo_url} alt="" width={size} height={size} />
      ) : (
        initials
      )}
    </span>
  );
}
