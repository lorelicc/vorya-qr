"use client";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import styles from "./Modal.module.css";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md";
};

/** Native <dialog>: focus trap, Esc and backdrop handled by the browser. */
export function Modal({ open, title, onClose, children, actions, size = "sm" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.modal} ${styles[size]}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.heading}>
            <h2 id={titleId}>{title}</h2>
            <IconButton label="Chiudi" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </header>
          <div className={styles.body}>{children}</div>
          {actions && <footer className={styles.actions}>{actions}</footer>}
        </div>
      )}
    </dialog>
  );
}
