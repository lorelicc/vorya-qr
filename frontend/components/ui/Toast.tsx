"use client";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string; leaving: boolean };
type ToastApi = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);
export const TOAST_DURATION = 4500;
const EXIT_MS = 140;
let counter = 0;

const ICON = { success: CheckCircle2, error: CircleAlert, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => {
    setItems((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setItems((all) => all.filter((t) => t.id !== id)), EXIT_MS);
  }, []);
  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++counter;
      setItems((all) => [...all.slice(-2), { id, tone, message, leaving: false }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((item) => {
          const Icon = ICON[item.tone];
          return (
            <div
              key={item.id}
              className={`${styles.toast} ${styles[item.tone]}`}
              data-leaving={item.leaving || undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.message}</span>
              <button type="button" aria-label="Chiudi notifica" onClick={() => dismiss(item.id)}>
                <X size={16} />
              </button>
              <i
                className={styles.timer}
                style={{ animationDuration: `${TOAST_DURATION}ms` }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast richiede ToastProvider");
  return api;
}
