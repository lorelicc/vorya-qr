"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { usePresence } from "@/lib/motion";
import styles from "./Menu.module.css";

type TriggerProps = {
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  "aria-controls": string;
  onClick: () => void;
};

type Props = {
  trigger: (props: TriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  placement?: "below" | "above";
  className?: string;
  label: string;
};

/** Dropdown: fades and scales from its opening corner; closes faster than it opens. */
export function Menu({
  trigger,
  children,
  align = "end",
  placement = "below",
  className,
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, state] = usePresence(open);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      const items = Array.from(
        root.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [],
      );
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(index + step + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (state === "open")
      root.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
  }, [state]);

  return (
    <div className={`${styles.menu} ${className ?? ""}`} ref={root}>
      {trigger({
        "aria-expanded": open,
        "aria-haspopup": "menu",
        "aria-controls": panelId,
        onClick: () => setOpen((value) => !value),
      })}
      {mounted && (
        <div
          id={panelId}
          role="menu"
          aria-label={label}
          className={styles.panel}
          data-state={state}
          data-align={align}
          data-placement={placement}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onSelect,
  active,
  disabled,
}: {
  children: ReactNode;
  onSelect: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={styles.item}
      data-active={active || undefined}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
