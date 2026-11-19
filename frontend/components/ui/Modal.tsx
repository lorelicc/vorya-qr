"use client";
import { X } from "lucide-react";
import { animate, motion, useDragControls, useMotionValue } from "motion/react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useReducedMotion, usePresence } from "@/lib/motion";
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

const MOBILE = "(max-width: 639px)";
const SWIPE_CLOSE_PX = 96;

function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const media = window.matchMedia?.(MOBILE);
      media?.addEventListener?.("change", cb);
      return () => media?.removeEventListener?.("change", cb);
    },
    () => window.matchMedia?.(MOBILE).matches ?? false,
    () => false,
  );
}

/**
 * Native <dialog> (focus trap, Esc, inert background). Desktop: fade + slight rise.
 * Below 640px it becomes a bottom sheet that can be dragged down to close.
 */
export function Modal({ open, title, onClose, children, actions, size = "sm" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mounted, state] = usePresence(open, 200);
  const mobile = useIsMobile();
  const reduced = useReducedMotion();
  const drag = useDragControls();
  const y = useMotionValue(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (mounted && !dialog.open) dialog.showModal?.();
    if (!mounted && dialog.open) dialog.close?.();
  }, [mounted]);

  useEffect(() => {
    if (open) y.set(0);
  }, [open, y]);

  const body = (
    <>
      <header className={styles.heading}>
        <h2 id={titleId}>{title}</h2>
        <IconButton label="Chiudi" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>
      <div className={styles.body}>{children}</div>
      {actions && <footer className={styles.actions}>{actions}</footer>}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={`${styles.modal} ${styles[size]} ${mobile ? styles.sheetHost : ""}`}
      data-state={state}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {mounted &&
        (mobile ? (
          <motion.div
            className={styles.sheet}
            data-state={state}
            style={{ y }}
            drag={reduced ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > SWIPE_CLOSE_PX || info.velocity.y > 600) onClose();
              else animate(y, 0, { type: "spring", stiffness: 420, damping: 36 });
            }}
          >
            <div
              className={styles.handle}
              onPointerDown={(event) => drag.start(event)}
              aria-hidden="true"
            >
              <span />
            </div>
            {body}
          </motion.div>
        ) : (
          <div className={styles.inner}>{body}</div>
        ))}
    </dialog>
  );
}
