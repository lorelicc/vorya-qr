"use client";
import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Menu, MenuItem } from "@/components/ui";
import { api } from "@/lib/api";
import styles from "./UserMenu.module.css";

const ROLE_LABEL = {
  super_admin: "Super Admin",
  platform_admin: "Admin piattaforma",
  company_admin: "Titolare",
} as const;

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: keyof typeof ROLE_LABEL;
}) {
  const router = useRouter();
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function logout() {
    await api("auth/logout", "POST").catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <Menu
      label="Menu utente"
      trigger={(props) => (
        <button type="button" className={styles.trigger} {...props}>
          <span className={styles.avatar} aria-hidden="true">
            {initials}
          </span>
          <span className={styles.name}>{name}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      )}
    >
      {() => (
        <>
          <div className={styles.identity}>
            <strong>{name}</strong>
            <span>{email}</span>
            <small>{ROLE_LABEL[role]}</small>
          </div>
          <MenuItem onSelect={logout}>
            <LogOut size={16} /> Esci
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
