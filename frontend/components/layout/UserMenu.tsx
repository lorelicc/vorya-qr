"use client";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !ref.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  async function logout() {
    await api("auth/logout", "POST").catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={styles.menu} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.name}>{name}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.panel} role="menu">
          <div className={styles.identity}>
            <strong>{name}</strong>
            <span>{email}</span>
            <small>{ROLE_LABEL[role]}</small>
          </div>
          <button type="button" role="menuitem" className={styles.item} onClick={logout}>
            <LogOut size={16} /> Esci
          </button>
        </div>
      )}
    </div>
  );
}
