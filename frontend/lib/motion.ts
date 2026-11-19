"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener?.("change", callback);
  return () => media?.removeEventListener?.("change", callback);
}

/** The single source of truth for JS components: true when the user asked for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
}

export const EXIT_MS = 140; // --dur-fast: closing is quicker than opening (--dur-base)

/**
 * Keeps an element mounted while it plays its exit animation.
 * Returns [mounted, state] where state drives `data-state="open|closed"` in CSS.
 */
export function usePresence(open: boolean, exitMs = EXIT_MS): [boolean, "open" | "closed"] {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");
  // Mount immediately when opening (render-phase update, no extra effect pass).
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    // The next frame flips data-state so the CSS transition actually runs.
    const frame = requestAnimationFrame(() => setState(open ? "open" : "closed"));
    if (open) return () => cancelAnimationFrame(frame);
    const timer = window.setTimeout(() => setMounted(false), reduced ? 0 : exitMs);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open, exitMs, reduced]);
  return [mounted, state];
}

/** Pauses decorative loops when off-screen or when the tab is hidden. */
export function useInView<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let inView = true;
    const update = () => setVisible(inView && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [ref]);
  return visible;
}
